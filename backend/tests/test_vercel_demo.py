"""Exercise the actual deployment entrypoint with the bundled course snapshot."""

import importlib
from pathlib import Path

from fastapi.testclient import TestClient


def test_public_demo_api_and_spa(monkeypatch):
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[2]))
    deployment = importlib.import_module("app")
    with TestClient(deployment.app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json()["status"] == "ok"
        assert health.json()["courses_loaded"] > 0
        metadata = client.get("/api/metadata").json()
        assert metadata["demo_mode"] is True
        assert metadata["semantic_ready"] is False
        assert deployment.api.state.accounts is None
        result = client.get("/api/keyword-search", params={"q": "01001241"})
        assert result.status_code == 200
        assert result.json()["total_results"] > 0
        validation = client.post(
            "/api/timetable/validate",
            json={"dataset_version": metadata["dataset_version"], "items": []},
        )
        assert validation.status_code == 200
        chat = client.post(
            "/api/chat",
            json={
                "message": "สนใจภาษา",
                "dataset_version": metadata["dataset_version"],
                "items": [],
            },
        )
        assert chat.status_code == 200
        for path in ("/api/auth/me", "/api/timetable"):
            assert client.get(path).status_code == 403
        assert (
            client.post(
                "/api/auth/login", json={"username": "demo", "password": "test-password"}
            ).status_code
            == 403
        )
        assert (
            client.post(
                "/api/auth/register",
                json={"username": "demo", "email": "demo@example.com", "password": "test-password"},
            ).status_code
            == 403
        )
        # API misses must never be swallowed by the SPA HTML fallback.
        assert client.get("/api/not-a-route").status_code == 404
        for path in ("/", "/timetable", "/chat", "/courses/01001241-64"):
            page = client.get(path, headers={"Accept": "text/html"})
            assert page.status_code == 200
            assert '<div id="root">' in page.text


def test_exact_course_codes_are_visible_even_without_ge_or_schedule(monkeypatch):
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[2]))
    deployment = importlib.import_module("app")
    codes = ["01219346-65", "01219325-65", "01219222-65", "01219497-65", "01219499-65"]
    missing = "01219346-99"
    with TestClient(deployment.app) as client:
        metadata = client.get("/api/metadata").json()
        response = client.post(
            "/api/chat?quick=true&ge_mode=fit",
            json={
                "message": "ค้นหารหัสวิชา " + "\n".join([*codes, missing]),
                "dataset_version": metadata["dataset_version"],
                "state": {"verified_ge_only": True, "days": ["Sat"], "offered_only": True},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["engine"] == "local-rules-fast"
        assert not data.get("answer_pending")
        assert data["search_context"]["scope"] == "catalog"
        assert data["state"]["verified_ge_only"]
        assert data["state"]["days"] == ["Sat"]
        assert [row["course"]["subject_code"] for row in data["results"]] == codes
        assert all(any(s["can_plan"] for s in row["sections"]) for row in data["results"][:2])
        assert all(not row["sections"] for row in data["results"][2:])
        assert "พบ 5 จาก 6 รหัส" in data["message"]
        assert ", ".join(codes[2:]) in data["message"]
        assert missing in data["message"]


def test_bangkhen_competencies_use_workbook_weights(monkeypatch):
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[2]))
    deployment = importlib.import_module("app")
    monkeypatch.delenv("CHAT_OLLAMA_MODEL", raising=False)
    with TestClient(deployment.app) as client:
        metadata = client.get("/api/metadata").json()
        ge = deployment.api.state.ge
        verified = [c for c in ge.courses.values() if c["status"] == "verified"]
        assert len(verified) == 193
        agriculture = ge.courses["01001317-67"]
        assert agriculture["competency_weights"][2] == 40
        assert 3 not in agriculture["competencies"]
        assert all(not c["competencies"] for c in ge.courses.values() if c["status"] == "mock")

        response = client.post(
            "/api/chat?quick=true&ge_mode=browse",
            json={
                "message": "สมรรถนะ 67 ด้าน 4",
                "dataset_version": metadata["dataset_version"],
                "state": {"interest": "unrelated previous search"},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["state"]["competency"] == 4
        assert data["state"]["interest"] == ""
        assert data["sources"]["ge"]["source_name"] == "gened.xlsx"
        assert data["total_results"] > 8
        weights = []
        for row in data["results"]:
            assert row["course"]["campus"] == "บางเขน"
            assert row["classification"]["status"] == "verified"
            weights.append(row["classification"]["competency_weights"]["4"])
        assert min(weights) > 0
        assert weights == sorted(weights, reverse=True)
