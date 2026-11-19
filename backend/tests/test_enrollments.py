import hashlib
import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

import enrollments
from enrollments import EnrollmentService, SemesterRequest, UpstreamError
from main import create_app

KEY = "synthetic-pilot-key-not-a-real-secret-0001"
STUDENT = "6500000001"
ROW = {
    "subject_code": "00000001-65",
    "subject_name": "Synthetic course",
    "enroll_status": "D",
    "instrs": [{"first_name": "Test", "last_name": "Teacher", "account": "test"}],
    "schedules": ["Th 16:30-19:30 Test-room"],
}


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("KUEDU_USERNAME", "synthetic-account")
    monkeypatch.setenv("KUEDU_PASSWORD", "synthetic-password")
    monkeypatch.setenv(
        "KUEDU_STUDENT_ACCESS",
        json.dumps(
            {
                hashlib.sha256(KEY.encode()).hexdigest(): {
                    "student_code": STUDENT,
                    "expires_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
                }
            }
        ),
    )


def test_lookup_bound_to_key_and_buddhist_year(client, configured, monkeypatch):
    calls = []

    def post(path, body, token=None):
        calls.append((path, body, token))
        return (
            {"access": "private-access", "refresh": "private-refresh"}
            if path == "/token/pair"
            else [ROW]
        )

    monkeypatch.setattr(enrollments, "post_json", post)
    client.app.state.enrollments = EnrollmentService()
    response = client.post(
        "/enrollments/semester",
        json={"academic_year": 2568, "semester": 2},
        headers={"X-Enrollment-Key": KEY},
    )
    assert response.status_code == 200
    assert response.json()["courses"] == [ROW]  # Preserve D and raw schedules without guessing.
    assert response.headers["cache-control"] == "no-store"
    assert "private-access" not in response.text
    assert STUDENT not in response.text
    assert calls[-1] == (
        "/std/enrollment/semester",
        {"student_code": STUDENT, "academic_year": 2568, "semester": 2},
        "private-access",
    )
    client.post(
        "/enrollments/semester",
        json={"academic_year": 2568, "semester": 1},
        headers={"X-Enrollment-Key": KEY},
    )
    assert len([path for path, _, _ in calls if path == "/token/pair"]) == 1
    calls.clear()
    for body, key, status in [
        ({"academic_year": 2025, "semester": 2}, KEY, 422),
        ({"academic_year": 2568, "semester": 0}, KEY, 422),
        ({"academic_year": 2568, "semester": 2, "student_code": "6500000002"}, KEY, 422),
        ({"academic_year": 2568, "semester": 2}, "wrong-key", 403),
        ({"academic_year": 2568, "semester": 2}, "", 403),
    ]:
        response = client.post(
            "/enrollments/semester", json=body, headers={"X-Enrollment-Key": key}
        )
        assert response.status_code == status
        assert response.headers["cache-control"] == "no-store"
    assert not calls


def test_expired_and_malformed_grants_fail_closed(configured, monkeypatch):
    service = EnrollmentService()
    service.grants[hashlib.sha256(KEY.encode()).hexdigest()] = (
        STUDENT,
        datetime.now(UTC) - timedelta(seconds=1),
    )
    with pytest.raises(Exception) as error:
        service.student(KEY)
    assert error.value.status_code == 403
    for value in ('{"plain-access-key": {}}', "[]", "invalid-json"):
        monkeypatch.setenv("KUEDU_STUDENT_ACCESS", value)
        assert not EnrollmentService().enabled


def test_refresh_on_401_and_reuse_new_token(configured, monkeypatch):
    calls = []

    def post(path, body, token=None):
        calls.append((path, body, token))
        if path == "/token/pair":
            return {"access": "old", "refresh": "refresh"}
        if path == "/token/refresh":
            return {"access": "new", "refresh": "rotated"}
        if token == "old":
            raise UpstreamError(401)
        return []

    monkeypatch.setattr(enrollments, "post_json", post)
    service = EnrollmentService()
    assert service.lookup(STUDENT, SemesterRequest(academic_year=2568, semester=2)) == []
    assert service.refresh == "rotated"
    assert [path for path, _, _ in calls] == [
        "/token/pair",
        "/std/enrollment/semester",
        "/token/refresh",
        "/std/enrollment/semester",
    ]
    service.lookup(STUDENT, SemesterRequest(academic_year=2568, semester=1))
    assert calls[-1][2] == "new"


def test_rejected_refresh_obtains_new_pair(configured, monkeypatch):
    def post(path, body, token=None):
        if path == "/token/refresh":
            raise UpstreamError(401)
        return {"access": "new", "refresh": "new-refresh"} if path == "/token/pair" else []

    monkeypatch.setattr(enrollments, "post_json", post)
    service = EnrollmentService()
    service.access, service.refresh = "expired", "expired-refresh"
    service.lookup(STUDENT, SemesterRequest(academic_year=2568, semester=2))
    assert service.access == "new"


@pytest.mark.parametrize(
    "result", [{"error": "private-upstream-detail"}, [dict(ROW, schedules=[{}])]]
)
def test_invalid_upstream_result_is_sanitized(configured, monkeypatch, result):
    monkeypatch.setattr(
        enrollments,
        "post_json",
        lambda path, body, token=None: (
            {"access": "private-token"} if path == "/token/pair" else result
        ),
    )
    with pytest.raises(Exception) as error:
        EnrollmentService().lookup(STUDENT, SemesterRequest(academic_year=2568, semester=1))
    assert error.value.status_code == 502
    assert "private" not in error.value.detail


@pytest.mark.parametrize("code, expected", [(401, 502), (403, 502), (500, 502), (504, 504)])
def test_upstream_errors_are_sanitized(configured, monkeypatch, code, expected):
    def post(*args):
        raise UpstreamError(code)

    monkeypatch.setattr(enrollments, "post_json", post)
    with pytest.raises(Exception) as error:
        EnrollmentService().lookup(STUDENT, SemesterRequest(academic_year=2568, semester=1))
    assert error.value.status_code == expected


def test_public_demo_uses_student_key_without_enabling_accounts(configured, tmp_path, monkeypatch):
    monkeypatch.setattr(
        enrollments,
        "post_json",
        lambda path, body, token=None: {"access": "private"} if path == "/token/pair" else [],
    )
    with TestClient(create_app(database_path=tmp_path / "unused.sqlite", demo=True)) as client:
        assert client.app.state.accounts is None
        assert client.get("/metadata").json()["enrollment_enabled"] is True
        assert (
            client.post(
                "/enrollments/semester",
                json={"academic_year": 2568, "semester": 2},
                headers={"X-Enrollment-Key": KEY},
            ).status_code
            == 200
        )
        assert client.get("/auth/me").status_code == 403


def test_unconfigured_does_not_contact_upstream(client, monkeypatch):
    monkeypatch.delenv("KUEDU_USERNAME", raising=False)
    client.app.state.enrollments = EnrollmentService()
    response = client.post("/enrollments/semester", json={"academic_year": 2568, "semester": 2})
    assert response.status_code == 503


def test_mounted_api_private_headers(configured, monkeypatch):
    from contextlib import asynccontextmanager

    from fastapi import FastAPI

    monkeypatch.setattr(
        enrollments,
        "post_json",
        lambda path, body, token=None: {"access": "private"} if path == "/token/pair" else [],
    )
    api = create_app(semantic=False, demo=True)

    @asynccontextmanager
    async def lifespan(app):
        async with api.router.lifespan_context(api):
            yield

    deployment = FastAPI(lifespan=lifespan)
    deployment.mount("/api", api)
    with TestClient(deployment) as client:
        for key, year, status in [(KEY, 2568, 200), ("invalid", 2568, 403), (KEY, 2025, 422)]:
            response = client.post(
                "/api/enrollments/semester",
                json={"academic_year": year, "semester": 2},
                headers={"X-Enrollment-Key": key},
            )
            assert response.status_code == status
            assert response.headers["cache-control"] == "no-store"
