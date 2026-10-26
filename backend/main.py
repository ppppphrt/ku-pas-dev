"""KU-PAS local API. Run uvicorn main:app from this directory."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from time import perf_counter

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.exceptions import HTTPException as StarletteHTTPException

from accounts import Accounts
from catalog import Catalog
from chat import ChatRequest, GEData, respond
from schemas import (
    Credentials,
    Filters,
    Registration,
    SearchRequest,
    SearchResponse,
    TimetableRequest,
    TimetableResponse,
)

ROOT = Path(__file__).parent
MODEL_NAME = os.getenv("MODEL_NAME", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger(__name__)


def create_app(catalog_path=None, database_path=None, semantic=None, demo=False):
    catalog_path = catalog_path or os.getenv("CATALOG_PATH", str(ROOT / "data/catalog.json.gz"))
    database_path = database_path or os.getenv(
        "DATABASE_PATH", str(ROOT / ".local/accounts.sqlite")
    )
    semantic = (
        os.getenv("SEMANTIC_ENABLED", "false").lower() == "true" if semantic is None else semantic
    )
    minimum = float(os.getenv("MIN_CREDITS", "9"))
    maximum = float(os.getenv("MAX_CREDITS", "22"))
    if not 0 <= minimum <= maximum:
        raise ValueError("Invalid configured credit limits")

    @asynccontextmanager
    async def lifespan(app):
        app.state.catalog = None
        app.state.data_error = None
        app.state.accounts = None if demo else Accounts(database_path, os.getenv("JWT_SECRET"))
        try:
            app.state.catalog = Catalog(catalog_path)
        except (OSError, ValueError, KeyError):
            app.state.data_error = "Catalog could not be loaded. Check the prepared data."
            log.exception("Catalog loading failed")
        if semantic and app.state.catalog:
            try:
                app.state.catalog.prepare_semantic(MODEL_NAME, ROOT / ".local/embeddings")
            except Exception:
                app.state.catalog.semantic_error = (
                    "Semantic model could not be loaded; keyword search is available."
                )
                log.exception("Semantic loading failed")
        app.state.ge = None
        if app.state.catalog:
            try:
                app.state.ge = GEData(
                    app.state.catalog, os.getenv("GE_DATA_PATH", str(ROOT / "data/gened.json"))
                )
            except (OSError, ValueError):
                log.exception("GE data unavailable; existing discovery remains available")
        yield

    app = FastAPI(title="KU-PAS Course and Timetable API", version="2.0.0", lifespan=lifespan)
    origins = [
        v.strip()
        for v in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if v.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request, exc):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": str(exc.status_code), "message": exc.detail}},
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        # Do not echo submitted credentials in validation error details.
        details = [
            {"field": ".".join(map(str, e["loc"])), "message": e["msg"]} for e in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Please check the supplied values.",
                    "details": details,
                }
            },
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request, exc):
        log.exception("Unhandled API error", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": {"code": "internal_error", "message": "An unexpected error occurred."}
            },
        )

    @app.middleware("http")
    async def response_time(request: Request, call_next):
        start = perf_counter()
        response = await call_next(request)
        elapsed = (perf_counter() - start) * 1000
        response.headers["X-Response-Time-Ms"] = f"{elapsed:.2f}"
        # Never log queries, tokens or submitted form bodies.
        log.info("%s %s %d %.2fms", request.method, request.url.path, response.status_code, elapsed)
        return response

    def catalog():
        if app.state.catalog is None:
            raise HTTPException(503, app.state.data_error)
        return app.state.catalog

    bearer = HTTPBearer(auto_error=False)

    def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        if demo:
            raise HTTPException(403, "Accounts are unavailable in the public demo. Use guest mode.")
        if credentials is None:
            raise HTTPException(401, "Please sign in.")
        try:
            return app.state.accounts.authenticate(credentials.credentials)
        except ValueError as exc:
            raise HTTPException(401, str(exc)) from exc

    @app.get("/health", tags=["System"])
    def health():
        c = app.state.catalog
        return {
            "status": "ok" if c else "degraded",
            "courses_loaded": len(c.courses) if c else 0,
            "semantic_ready": bool(c and c.embeddings is not None),
            "detail": app.state.data_error or (c.semantic_error if c else None),
        }

    @app.get("/metadata", tags=["System"])
    def metadata():
        c = catalog()
        return {
            **c.metadata,
            "faculties": sorted(
                {s["faculty"] for course in c.courses for s in course["sections"] if s["faculty"]}
                | {course["faculty"] for course in c.courses if course["faculty"]}
            ),
            "semantic_ready": c.embeddings is not None,
            "demo_mode": demo,
            "min_credits": minimum,
            "max_credits": maximum,
            "credit_rules_note": "Configurable planning thresholds; confirm your program rules.",
        }

    def search_response(query, mode, filters, page, size, threshold=0.2):
        start = perf_counter()
        c = catalog()
        indices = c.filtered(filters)
        try:
            ranked = (
                c.semantic(query, indices, threshold)
                if mode == "semantic"
                else c.keyword(query, indices)
            )
        except RuntimeError as exc:
            raise HTTPException(503, str(exc)) from exc
        offset = (page - 1) * size
        results = [
            {**c.courses[i], "rank": rank, "similarity_score": score}
            for rank, (i, score) in enumerate(ranked[offset : offset + size], offset + 1)
        ]
        return {
            "query": query,
            "mode": mode,
            "results": results,
            "total_returned": len(results),
            "total_results": len(ranked),
            "page": page,
            "page_size": size,
            "has_more": offset + size < len(ranked),
            "active_filters": filters,
            "elapsed_ms": round((perf_counter() - start) * 1000, 2),
            "dataset_version": c.metadata["dataset_version"],
        }

    def request_filters(
        faculty: str | None = None,
        min_credits: float | None = Query(None, ge=0, le=100),
        max_credits: float | None = Query(None, ge=0, le=100),
        days: list[str] = Query(default=[]),
        start_time: str | None = None,
        end_time: str | None = None,
        offered_only: bool = False,
    ):
        try:
            return Filters(
                faculty=faculty,
                min_credits=min_credits,
                max_credits=max_credits,
                days=days,
                start_time=start_time,
                end_time=end_time,
                offered_only=offered_only,
            )
        except ValueError as exc:
            raise HTTPException(422, "Invalid day, time, or credit filter range.") from exc

    def valid_query(q):
        if not q.strip():
            raise HTTPException(400, "Query must not be empty.")
        return q.strip()

    @app.get("/keyword-search", response_model=SearchResponse, tags=["Search"])
    def keyword(
        q: str = Query(min_length=1, max_length=1000),
        top_n: int = Query(20, ge=1, le=100),
        page: int = Query(1, ge=1),
        filters: Filters = Depends(request_filters),
    ):
        return search_response(valid_query(q), "keyword", filters, page, top_n)

    @app.get("/search", response_model=SearchResponse, tags=["Search"])
    def semantic_get(
        q: str = Query(min_length=1, max_length=1000),
        top_n: int = Query(20, ge=1, le=100),
        page: int = Query(1, ge=1),
        min_similarity: float = Query(0.2, ge=-1, le=1),
        filters: Filters = Depends(request_filters),
    ):
        return search_response(valid_query(q), "semantic", filters, page, top_n, min_similarity)

    @app.post("/search", response_model=SearchResponse, tags=["Search"])
    def semantic_post(body: SearchRequest):
        filters = Filters(**{key: getattr(body, key) for key in Filters.model_fields})
        return search_response(
            body.query, "semantic", filters, body.page, body.top_n, body.min_similarity
        )

    @app.get("/courses", tags=["Courses"])
    def courses(
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        filters: Filters = Depends(request_filters),
    ):
        c = catalog()
        indices = c.filtered(filters)
        offset = (page - 1) * page_size
        return {
            "page": page,
            "page_size": page_size,
            "total_courses": len(indices),
            "courses": [c.courses[i] for i in indices[offset : offset + page_size]],
            "has_more": offset + page_size < len(indices),
            "active_filters": filters,
            "dataset_version": c.metadata["dataset_version"],
        }

    @app.get("/courses/{subject_code}", tags=["Courses"])
    def course(subject_code: str):
        found = catalog().by_code.get(subject_code)
        if found is None:
            raise HTTPException(404, "Course not found.")
        return found

    @app.post("/chat", tags=["Chat"])
    def chat(body: ChatRequest):
        c = catalog()
        if body.dataset_version != c.metadata["dataset_version"]:
            raise HTTPException(409, "ข้อมูลเปลี่ยนแล้ว กรุณาโหลดหน้าใหม่และตรวจตารางอีกครั้ง")
        if app.state.ge is None:
            raise HTTPException(503, "ยังไม่มีข้อมูล GE ที่ตรงกับ snapshot นี้ โปรดตรวจ GE_DATA_PATH")
        if not body.message.strip():
            raise HTTPException(422, "กรุณาพิมพ์คำถาม")
        try:
            return respond(body, c, app.state.ge)
        except ValueError as exc:
            raise HTTPException(422, "ตรวจเงื่อนไขวัน เวลา หน่วยกิต และรายการในตารางอีกครั้ง") from exc

    def validate_timetable(body):
        c = catalog()
        if body.dataset_version != c.metadata["dataset_version"]:
            raise HTTPException(
                409, "The dataset changed. Review and rebuild your timetable for this snapshot."
            )
        try:
            return c.timetable(body.items, minimum, maximum)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @app.post("/timetable/validate", response_model=TimetableResponse, tags=["Timetable"])
    def validate(body: TimetableRequest):
        return validate_timetable(body)

    @app.get("/timetable", response_model=TimetableResponse, tags=["Timetable"])
    def get_timetable(user=Depends(current_user)):
        saved = app.state.accounts.load(user)
        body = TimetableRequest.model_validate(
            saved or {"dataset_version": catalog().metadata["dataset_version"], "items": []}
        )
        return validate_timetable(body)

    @app.put("/timetable", response_model=TimetableResponse, tags=["Timetable"])
    def save_timetable(body: TimetableRequest, user=Depends(current_user)):
        result = validate_timetable(body)
        if result["conflicts"]:
            raise HTTPException(
                409,
                {
                    "message": "Conflicting sections cannot be saved.",
                    "conflicts": result["conflicts"],
                },
            )
        app.state.accounts.save(user, body.model_dump())
        return result

    @app.post("/auth/register", tags=["Account"], status_code=201)
    def register(body: Registration):
        if demo:
            raise HTTPException(403, "Accounts are unavailable in the public demo. Use guest mode.")
        try:
            return app.state.accounts.register(body.username, body.email, body.password)
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from exc

    @app.post("/auth/login", tags=["Account"])
    def login(body: Credentials):
        if demo:
            raise HTTPException(403, "Accounts are unavailable in the public demo. Use guest mode.")
        try:
            return app.state.accounts.login(body.username, body.password)
        except ValueError as exc:
            raise HTTPException(401, str(exc)) from exc

    @app.get("/auth/me", tags=["Account"])
    def me(user=Depends(current_user)):
        return {key: user[key] for key in ("id", "username", "email")}

    @app.post("/auth/logout", tags=["Account"])
    def logout(user=Depends(current_user)):
        app.state.accounts.logout(user)
        return {"status": "signed_out"}

    return app


app = create_app()
