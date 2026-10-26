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
            json={"message": "สนใจภาษา", "dataset_version": metadata["dataset_version"], "items": []},
        )
        assert chat.status_code == 200
        for path in ("/api/auth/me", "/api/timetable"):
            assert client.get(path).status_code == 403
        assert client.post(
            "/api/auth/login", json={"username": "demo", "password": "test-password"}
        ).status_code == 403
        assert client.post(
            "/api/auth/register",
            json={"username": "demo", "email": "demo@example.com", "password": "test-password"},
        ).status_code == 403
        # API misses must never be swallowed by the SPA HTML fallback.
        assert client.get("/api/not-a-route").status_code == 404
        for path in ("/", "/timetable", "/chat", "/courses/01001241-64"):
            page = client.get(path, headers={"Accept": "text/html"})
            assert page.status_code == 200
            assert '<div id="root">' in page.text
