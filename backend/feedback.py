"""Consent-based feedback, signed evidence, authenticated review and curated JSONL export."""

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Literal
from uuid import uuid4

import jwt
from fastapi import Header, HTTPException, Query, Response
from pydantic import Field, model_validator

import chat_llm
from schemas import StrictModel

PROMPT_VERSION = "chat-ge-catalog-v2"


class FeedbackInput(StrictModel):
    receipt: str = Field(min_length=1, max_length=180000)
    rating: Literal["helpful", "not_helpful"]
    category: Literal["understanding", "facts", "retrieval", "style", "other"]
    comment: str = Field(default="", max_length=2000)
    consent: bool = False
    allow_training: bool = False

    @model_validator(mode="after")
    def consent_and_reason(self):
        if not self.consent:
            raise ValueError("Consent is required before storing conversation feedback")
        if self.rating == "not_helpful" and not self.comment.strip():
            raise ValueError("Please explain what needs to be improved")
        return self


class ReviewInput(StrictModel):
    expected_version: int = Field(ge=1)
    decision: Literal["approved", "rejected"]
    reviewer: str = Field(min_length=1, max_length=100)
    review_note: str = Field(min_length=1, max_length=2000)
    training_input: str = Field(default="", max_length=20000)
    corrected_answer: str = Field(default="", max_length=10000)
    source_checked: bool = False
    privacy_checked: bool = False

    @model_validator(mode="after")
    def reviewed_example(self):
        if self.decision == "approved" and not (
            self.training_input.strip()
            and self.corrected_answer.strip()
            and self.source_checked
            and self.privacy_checked
        ):
            raise ValueError("Approval requires a corrected example, source and privacy checks")
        if not self.reviewer.strip() or not self.review_note.strip():
            raise ValueError("Reviewer and review rationale are required")
        return self


class Store:
    def __init__(self, target):
        self.target = str(target)
        self.postgres = self.target.startswith(("postgres://", "postgresql://"))
        if not self.postgres:
            Path(self.target).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            self.execute(
                db,
                """CREATE TABLE IF NOT EXISTS chat_feedback (
                id TEXT PRIMARY KEY, receipt_id TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
                rating TEXT NOT NULL, category TEXT NOT NULL, comment TEXT NOT NULL,
                allow_training INTEGER NOT NULL, snapshot TEXT NOT NULL,
                dataset_split TEXT NOT NULL CHECK(dataset_split IN ('train','eval')),
                version INTEGER NOT NULL DEFAULT 1,
                training_input TEXT NOT NULL DEFAULT '', corrected_answer TEXT NOT NULL DEFAULT '',
                review_note TEXT NOT NULL DEFAULT '', reviewer TEXT NOT NULL DEFAULT '',
                reviewed_at TEXT, source_checked INTEGER NOT NULL DEFAULT 0,
                privacy_checked INTEGER NOT NULL DEFAULT 0
            )""",
            )
            self.execute(
                db,
                """CREATE TABLE IF NOT EXISTS chat_feedback_reviews (
                id TEXT PRIMARY KEY, feedback_id TEXT NOT NULL REFERENCES chat_feedback(id),
                created_at TEXT NOT NULL, review_version INTEGER NOT NULL,
                decision TEXT NOT NULL, review TEXT NOT NULL
            )""",
            )
            self.execute(
                db,
                "CREATE INDEX IF NOT EXISTS feedback_status_created ON chat_feedback(status, created_at)",
            )

    @contextmanager
    def connect(self):
        if self.postgres:
            import psycopg
            from psycopg.rows import dict_row

            db = psycopg.connect(
                self.target,
                sslmode="require",
                connect_timeout=10,
                row_factory=dict_row,
                prepare_threshold=None,
            )
        else:
            db = sqlite3.connect(self.target, timeout=10)
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA foreign_keys=ON")
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def execute(self, db, query, values=()):
        return db.execute(query.replace("?", "%s") if self.postgres else query, values)

    @staticmethod
    def decoded(row):
        item = dict(row)
        item["snapshot"] = json.loads(item["snapshot"])
        return item

    def submit(self, body, snapshot):
        now = datetime.now(UTC).isoformat()
        receipt_id = snapshot["jti"]
        split = (
            "eval"
            if int(hashlib.sha256(snapshot["conversation_group"].encode()).hexdigest(), 16) % 5 == 0
            else "train"
        )
        with self.connect() as db:
            self.execute(
                db,
                """INSERT INTO chat_feedback
                (id,receipt_id,created_at,updated_at,status,rating,category,comment,allow_training,snapshot,dataset_split)
                VALUES(?,?,?,?,'pending',?,?,?,?,?,?) ON CONFLICT(receipt_id) DO NOTHING""",
                (
                    str(uuid4()),
                    receipt_id,
                    now,
                    now,
                    body.rating,
                    body.category,
                    body.comment.strip(),
                    int(body.allow_training),
                    json.dumps(snapshot, ensure_ascii=False),
                    split,
                ),
            )
            row = self.execute(
                db, "SELECT id,status FROM chat_feedback WHERE receipt_id=?", (receipt_id,)
            ).fetchone()
        return dict(row)

    def list(self, status, limit):
        with self.connect() as db:
            rows = self.execute(
                db,
                "SELECT * FROM chat_feedback WHERE status=? ORDER BY created_at DESC LIMIT ?",
                (status, limit),
            ).fetchall()
        return [self.decoded(row) for row in rows]

    def get(self, ident):
        with self.connect() as db:
            row = self.execute(db, "SELECT * FROM chat_feedback WHERE id=?", (ident,)).fetchone()
            if row is None:
                raise HTTPException(404, "Feedback not found")
            events = self.execute(
                db,
                "SELECT created_at,review_version,decision,review FROM chat_feedback_reviews WHERE feedback_id=? ORDER BY review_version",
                (ident,),
            ).fetchall()
        result = self.decoded(row)
        result["reviews"] = [{**dict(e), "review": json.loads(e["review"])} for e in events]
        return result

    def review(self, ident, body):
        now = datetime.now(UTC).isoformat()
        with self.connect() as db:
            result = self.execute(
                db,
                """UPDATE chat_feedback SET status=?,updated_at=?,version=version+1,
                training_input=?,corrected_answer=?,review_note=?,reviewer=?,reviewed_at=?,source_checked=?,privacy_checked=?
                WHERE id=? AND version=?""",
                (
                    body.decision,
                    now,
                    body.training_input.strip(),
                    body.corrected_answer.strip(),
                    body.review_note.strip(),
                    body.reviewer.strip(),
                    now,
                    int(body.source_checked),
                    int(body.privacy_checked),
                    ident,
                    body.expected_version,
                ),
            )
            if result.rowcount != 1:
                raise HTTPException(
                    409, "Feedback changed or no longer exists; reload before reviewing"
                )
            self.execute(
                db,
                "INSERT INTO chat_feedback_reviews(id,feedback_id,created_at,review_version,decision,review) VALUES(?,?,?,?,?,?)",
                (
                    str(uuid4()),
                    ident,
                    now,
                    body.expected_version + 1,
                    body.decision,
                    body.model_dump_json(),
                ),
            )
        return self.get(ident)

    def export(self, split):
        with self.connect() as db:
            rows = self.execute(
                db,
                """SELECT DISTINCT a.training_input,a.corrected_answer FROM chat_feedback a
                WHERE a.status='approved' AND a.allow_training=1 AND a.source_checked=1 AND a.privacy_checked=1
                AND a.dataset_split=? AND (?='eval' OR NOT EXISTS (
                    SELECT 1 FROM chat_feedback b WHERE b.training_input=a.training_input
                    AND b.dataset_split='eval' AND b.status='approved' AND b.allow_training=1
                    AND b.source_checked=1 AND b.privacy_checked=1
                )) ORDER BY a.training_input,a.corrected_answer LIMIT 1000""",
                (split, split),
            ).fetchall()
        # Only manually reviewed/edited input is exported. Never append raw conversation.
        return "".join(
            json.dumps(
                {
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a course adviser. Use only supplied evidence; clarify ambiguous requests and never invent availability or eligibility.",
                        },
                        {"role": "user", "content": row["training_input"]},
                        {"role": "assistant", "content": row["corrected_answer"]},
                    ]
                },
                ensure_ascii=False,
            )
            + "\n"
            for row in rows
        )


class FeedbackService:
    def __init__(self, store, signing_secret, review_key):
        if len(signing_secret) < 32 or len(review_key) < 32 or signing_secret == review_key:
            raise ValueError("Feedback requires two distinct secrets of at least 32 characters")
        self.store, self.signing_secret, self.review_key = store, signing_secret, review_key

    @classmethod
    def configured(cls, demo, local_dir):
        target = (
            os.getenv("FEEDBACK_DATABASE_URL")
            or os.getenv("POSTGRES_URL")
            or os.getenv("DATABASE_URL")
        )
        signing, review = os.getenv("FEEDBACK_SIGNING_SECRET"), os.getenv("FEEDBACK_REVIEW_TOKEN")
        if demo and not (
            target and target.startswith(("postgres://", "postgresql://")) and signing and review
        ):
            return None  # No ephemeral SQLite fallback in production.
        if not demo:
            local_dir = Path(local_dir)
            local_dir.mkdir(parents=True, exist_ok=True)

            def local_secret(name):
                path = local_dir / name
                try:
                    with path.open("x") as f:
                        path.chmod(0o600)
                        f.write(secrets.token_urlsafe(48))
                except FileExistsError:
                    pass
                return path.read_text().strip()

            signing = signing or local_secret("feedback-signing.secret")
            review = review or local_secret("feedback-review.secret")
            target = target or str(local_dir / "feedback.sqlite")
        return cls(Store(target), signing, review)

    def receipt(self, body, result):
        now = datetime.now(UTC)
        evidence = [
            {
                "code": row["course"]["subject_code"],
                "name_th": row["course"]["subject_name_th"],
                "name_en": row["course"]["subject_name_en"],
                "classification": row["classification"],
                "sections": [
                    {
                        "section_id": s["section"]["section_id"],
                        "time_slots": s["section"]["time_slots"],
                        "can_plan": s["can_plan"],
                    }
                    for s in row["sections"][:12]
                ],
            }
            for row in result["results"]
        ]
        first_question = body.history[0].content if body.history else body.message
        group = body.conversation_id or " ".join(first_question.casefold().split())
        group_digest = hmac.new(
            self.signing_secret.encode(), group.encode(), hashlib.sha256
        ).hexdigest()
        payload = {
            "conversation_group": group_digest,
            "jti": str(uuid4()),
            "iat": now,
            "exp": now + timedelta(days=7),
            "iss": "ku-pas",
            "aud": "chat-ge-feedback",
            "prompt_version": PROMPT_VERSION,
            "question": body.message,
            "history": [t.model_dump() for t in body.history[-6:]],
            "state": result["state"].model_dump(),
            "answer": result["message"],
            "dataset_version": body.dataset_version,
            "engine": result["engine"],
            "model": chat_llm.settings()["model"] or os.getenv("CHAT_OLLAMA_MODEL"),
            "sources": result.get("sources"),
            "retrieval": result.get("retrieval"),
            "evidence": evidence,
        }
        # Nothing is written until the user explicitly submits consent-based feedback.
        token = jwt.encode(payload, self.signing_secret, algorithm="HS256")
        return token if len(token) <= 180000 else None

    def verify(self, receipt):
        try:
            return jwt.decode(
                receipt,
                self.signing_secret,
                algorithms=["HS256"],
                audience="chat-ge-feedback",
                issuer="ku-pas",
                options={"require": ["exp", "iat", "jti", "aud", "iss"]},
            )
        except jwt.InvalidTokenError as exc:
            raise HTTPException(
                400, "Feedback expired or could not be verified; ask again before submitting"
            ) from exc


def install_routes(app):
    def service():
        value = getattr(app.state, "feedback", None)
        if value is None:
            raise HTTPException(
                503, "Feedback storage is not configured or is temporarily unavailable"
            )
        return value

    def reviewer(key):
        svc = service()
        if not key or not hmac.compare_digest(key.encode(), svc.review_key.encode()):
            raise HTTPException(403, "Reviewer access is required")
        return svc

    @app.get("/feedback/config", tags=["Feedback"])
    def config():
        return {
            "enabled": getattr(app.state, "feedback", None) is not None,
            "automatic_training": False,
        }

    @app.post("/feedback", tags=["Feedback"])
    def submit(body: FeedbackInput):
        svc = service()
        return svc.store.submit(body, svc.verify(body.receipt))

    @app.get("/feedback/review", tags=["Feedback review"])
    def queue(
        status: Literal["pending", "approved", "rejected"] = "pending",
        limit: int = Query(default=30, ge=1, le=100),
        x_feedback_review_key: str | None = Header(default=None),
    ):
        svc = reviewer(x_feedback_review_key)
        return {"items": svc.store.list(status, limit)}

    @app.get("/feedback/export", tags=["Feedback review"])
    def export(
        split: Literal["train", "eval"], x_feedback_review_key: str | None = Header(default=None)
    ):
        svc = reviewer(x_feedback_review_key)
        return Response(
            svc.store.export(split),
            media_type="application/x-ndjson",
            headers={
                "Content-Disposition": f'attachment; filename="chat-ge-{split}.jsonl"',
                "Cache-Control": "no-store",
            },
        )

    @app.get("/feedback/review/{ident}", tags=["Feedback review"])
    def detail(ident: str, x_feedback_review_key: str | None = Header(default=None)):
        return reviewer(x_feedback_review_key).store.get(ident)

    @app.put("/feedback/review/{ident}", tags=["Feedback review"])
    def decide(
        ident: str, body: ReviewInput, x_feedback_review_key: str | None = Header(default=None)
    ):
        return reviewer(x_feedback_review_key).store.review(ident, body)
