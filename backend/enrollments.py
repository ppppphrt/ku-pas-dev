"""Server-only KU-EDU client and per-student pilot access capabilities."""

import hashlib
import json
import os
import re
import threading
from datetime import UTC, datetime
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from fastapi import Header, HTTPException
from pydantic import Field

from schemas import StrictModel

BASE_URL = "https://webhost.oea.ku.ac.th/kuedu/api"
MAX_RESPONSE = 2 * 1024 * 1024


class SemesterRequest(StrictModel):
    # KU-EDU expects the Buddhist Era academic year, never Gregorian conversion.
    academic_year: int = Field(ge=2500, le=2700, strict=True)
    semester: int = Field(ge=1, le=3, strict=True)


class Instructor(StrictModel):
    first_name: str
    last_name: str
    account: str


class Enrollment(StrictModel):
    subject_code: str
    subject_name: str
    enroll_status: str
    instrs: list[Instructor]
    schedules: list[str]


class UpstreamError(Exception):
    def __init__(self, status):
        self.status = status


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward credentials to another destination.


def post_json(path, body, token=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(BASE_URL + path, json.dumps(body).encode(), headers, method="POST")
    try:
        with build_opener(NoRedirects).open(request, timeout=10) as response:
            content = response.read(MAX_RESPONSE + 1)
            if len(content) > MAX_RESPONSE:
                raise UpstreamError(502)
            return json.loads(content)
    except HTTPError as exc:
        exc.close()
        raise UpstreamError(exc.code) from None
    except (URLError, TimeoutError, OSError) as exc:
        raise UpstreamError(504) from exc
    except (ValueError, UnicodeError) as exc:
        raise UpstreamError(502) from exc


class EnrollmentService:
    def __init__(self):
        self.username = os.getenv("KUEDU_USERNAME", "")
        self.password = os.getenv("KUEDU_PASSWORD", "")
        self.grants = {}
        self.access = None
        self.refresh = None
        self.expires = 0
        self.lock = threading.Lock()
        try:
            grants = json.loads(os.getenv("KUEDU_STUDENT_ACCESS", "{}"))
            if not isinstance(grants, dict):
                raise ValueError("Invalid access configuration")
            for digest, grant in grants.items():
                if not re.fullmatch(r"[a-f0-9]{64}", digest):
                    raise ValueError("Invalid access digest")
                if not re.fullmatch(r"[0-9]{10}", grant["student_code"]):
                    raise ValueError("Invalid student code")
                expiry = datetime.fromisoformat(grant["expires_at"])
                if expiry.tzinfo is None:
                    raise ValueError("Access expiry needs a timezone")
                self.grants[digest] = (grant["student_code"], expiry)
        except (ValueError, TypeError, KeyError, AttributeError):
            # Fail closed without logging secrets or preventing catalog startup.
            self.grants = {}

    @property
    def enabled(self):
        return bool(self.username and self.password and self.grants)

    def student(self, key):
        if not self.enabled:
            raise HTTPException(503, "Enrollment lookup is not configured.")
        digest = hashlib.sha256((key or "").encode()).hexdigest()
        grant = self.grants.get(digest)
        if not grant or grant[1] <= datetime.now(UTC):
            raise HTTPException(403, "Invalid or expired student access code.")
        return grant[0]

    def token(self, rejected=None):
        with self.lock:
            if self.access and monotonic() < self.expires and self.access != rejected:
                return self.access
            result = None
            if self.refresh:
                try:
                    result = post_json("/token/refresh", {"refresh": self.refresh})
                except UpstreamError as exc:
                    if exc.status not in (400, 401, 403):
                        raise
                    self.refresh = None
            if result is None:
                result = post_json(
                    "/token/pair", {"username": self.username, "password": self.password}
                )
            if not isinstance(result, dict) or not isinstance(result.get("access"), str):
                raise UpstreamError(502)
            if not result["access"]:
                raise UpstreamError(502)
            self.access = result["access"]
            self.refresh = result.get("refresh", self.refresh)
            # A 401 always forces renewal even if upstream uses a shorter lifetime.
            self.expires = monotonic() + 240
            return self.access

    def lookup(self, student_code, body):
        payload = {"student_code": student_code, **body.model_dump()}
        try:
            token = self.token()
            try:
                result = post_json("/std/enrollment/semester", payload, token)
            except UpstreamError as exc:
                if exc.status != 401:
                    raise
                result = post_json("/std/enrollment/semester", payload, self.token(rejected=token))
            if not isinstance(result, list):
                raise UpstreamError(502)
            # Validate upstream content before returning it; never leak token responses.
            return [Enrollment.model_validate(row).model_dump() for row in result]
        except UpstreamError as exc:
            status = 504 if exc.status == 504 else 502
            raise HTTPException(
                status, "KU enrollment service is unavailable. Please try again."
            ) from None
        except (ValueError, TypeError):
            raise HTTPException(
                502, "KU enrollment service returned an invalid response."
            ) from None


def install_routes(app):
    @app.post("/enrollments/semester", tags=["Enrollment"])
    def semester(
        body: SemesterRequest,
        key: str | None = Header(None, alias="X-Enrollment-Key", max_length=256),
    ):
        service = app.state.enrollments
        student_code = service.student(key)
        return {
            **body.model_dump(),
            "source": "KU-EDU",
            "courses": service.lookup(student_code, body),
        }
