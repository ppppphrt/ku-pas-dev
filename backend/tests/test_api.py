import json

import numpy as np
import pytest

from schemas import SearchResponse, TimetableResponse


def payload(*codes):
    return {
        "dataset_version": "test-v1",
        "items": [{"subject_code": code, "section_id": "s" + code} for code in codes],
    }


def test_search_by_code_name_thai_and_rank(client):
    result = client.get("/keyword-search", params={"q": " 001 - 61 "}).json()
    assert result["results"][0]["subject_code"] == "001-61"
    result = client.get("/keyword-search", params={"q": "PROGRAMMING", "top_n": 1}).json()
    assert result["results"][0]["subject_name_en"] == "Programming"
    assert result["total_results"] == 2
    assert result["has_more"]
    assert client.get("/keyword-search", params={"q": "วิชา"}).json()["total_results"] == 5
    SearchResponse.model_validate(result)


@pytest.mark.parametrize("path", ["/keyword-search", "/search"])
@pytest.mark.parametrize(
    "params,status",
    [
        ({"q": "   "}, 400),
        ({"q": "x", "top_n": 0}, 422),
        ({"q": "x", "top_n": 101}, 422),
        ({"q": "x", "page": 0}, 422),
    ],
)
def test_invalid_search(client, path, params, status):
    response = client.get(path, params=params)
    assert response.status_code == status
    assert "error" in response.json()


def test_filters_check_entire_section_and_unknown_credits(client):
    assert client.get("/courses", params={"days": "Mon"}).json()["total_courses"] == 1
    response = client.get(
        "/keyword-search",
        params=[
            ("q", "Programming"),
            ("days", "Mon"),
            ("days", "Wed"),
            ("start_time", "09:00"),
            ("end_time", "10:00"),
            ("faculty", "Science"),
            ("min_credits", "3"),
            ("max_credits", "3"),
        ],
    )
    assert response.status_code == 200
    assert [c["subject_code"] for c in response.json()["results"]] == ["001-61"]
    assert client.get("/courses", params={"min_credits": 0}).json()["total_courses"] == 4
    assert client.get("/courses", params={"min_credits": 4, "max_credits": 2}).status_code == 422
    assert client.get("/courses", params={"days": "Invalid"}).status_code == 422
    assert (
        client.get("/courses", params={"start_time": "11:00", "end_time": "09:00"}).status_code
        == 422
    )


def test_course_details_pagination_and_missing(client):
    assert (
        client.get("/courses?page_size=2&page=2").json()["courses"][0]["subject_code"] == "003-61"
    )
    course = client.get("/courses/001-61").json()
    assert len(course["sections"][0]["time_slots"]) == 2
    assert client.get("/courses/FAKE").status_code == 404
    assert client.get("/missing").json()["error"]["code"] == "404"


def test_semantic_offline_returns_service_unavailable(client):
    assert client.get("/search?q=programming").status_code == 503
    assert client.post("/search", json={"query": "  "}).status_code == 422


def test_semantic_get_post_filters_and_threshold(client):
    class Model:
        def encode(self, texts, **kwargs):
            return np.array([[1.0, 0.0]])

    catalog = client.app.state.catalog
    catalog.model = Model()
    catalog.embeddings = np.array([[1.0, 0.0], [0.9, 0.1], [0.5, 0.5], [0.1, 0.9], [0.0, 1.0]])
    get = client.get(
        "/search", params={"q": "natural query", "min_similarity": 0.8, "max_credits": 3}
    ).json()
    post = client.post(
        "/search", json={"query": "natural query", "min_similarity": 0.8, "max_credits": 3}
    ).json()
    assert len(get["results"]) == 2
    assert get["results"] == post["results"]
    SearchResponse.model_validate(get)


def test_consecutive_classes_and_multiday_conflict(client):
    safe = client.post("/timetable/validate", json=payload("001-61", "002-61")).json()
    assert not safe["conflicts"]
    assert safe["total_credits"] == 6
    assert safe["course_count"] == 2
    assert safe["credit_status"] == "Warning"
    TimetableResponse.model_validate(safe)
    collision = client.post("/timetable/validate", json=payload("001-61", "003-61")).json()
    assert collision["conflicts"] == [
        {
            "first": {"subject_code": "001-61", "section_id": "s001-61"},
            "second": {"subject_code": "003-61", "section_id": "s003-61"},
            "day": "Wed",
            "start": "09:30",
            "end": "10:00",
        }
    ]


@pytest.mark.parametrize("codes", [("001-61", "001-61"), ("004-61",), ("005-61",), ("FAKE",)])
def test_unsafe_timetables_rejected(client, codes):
    assert client.post("/timetable/validate", json=payload(*codes)).status_code == 422


def test_stale_dataset_and_wrong_section_rejected(client):
    body = payload("001-61")
    body["dataset_version"] = "old"
    assert client.post("/timetable/validate", json=body).status_code == 409
    body = payload("001-61")
    body["items"][0]["section_id"] = "s002-61"
    assert client.post("/timetable/validate", json=body).status_code == 422


def test_credit_normal_and_exceeded(client):
    catalog = client.app.state.catalog
    from schemas import TimetableRef

    refs = [TimetableRef(subject_code="001-61", section_id="s001-61")]
    assert catalog.timetable(refs, 3, 3)["credit_status"] == "Normal"
    assert catalog.timetable(refs, 1, 2)["credit_status"] == "Exceeded"


def account(client, username):
    result = client.post(
        "/auth/register",
        json={
            "username": username,
            "email": f"{username}@example.test",
            "password": "test-password-123",
        },
    )
    assert result.status_code == 201
    return {"Authorization": "Bearer " + result.json()["access_token"]}


def test_accounts_persistence_isolation_conflicts_and_logout(client):
    first = account(client, "first")
    second = account(client, "second")
    assert client.put("/timetable", json=payload("001-61"), headers=first).status_code == 200
    assert client.get("/timetable", headers=first).json()["total_credits"] == 3
    assert client.get("/timetable", headers=second).json()["items"] == []
    assert (
        client.put("/timetable", json=payload("001-61", "003-61"), headers=first).status_code == 409
    )
    assert client.get("/timetable", headers=first).json()["total_credits"] == 3
    assert (
        client.post(
            "/auth/login", json={"username": "first", "password": "wrong-password"}
        ).status_code
        == 401
    )
    login = client.post("/auth/login", json={"username": "first", "password": "test-password-123"})
    assert login.status_code == 200
    with client.app.state.accounts.connect() as db:
        stored = db.execute("SELECT password FROM users").fetchone()[0]
        assert "test-password" not in stored
    assert client.post("/auth/logout", headers=first).status_code == 200
    assert client.get("/auth/me", headers=first).status_code == 401
    assert client.get("/timetable").status_code == 401


def test_validation_never_echoes_password(client):
    response = client.post(
        "/auth/register", json={"username": "?", "password": "private", "email": "bad"}
    )
    assert response.status_code == 422
    assert "private" not in json.dumps(response.json())


def test_local_cors(client):
    response = client.options(
        "/courses",
        headers={"Origin": "http://127.0.0.1:5173", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
    response = client.options(
        "/courses",
        headers={"Origin": "https://example.test", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in response.headers
