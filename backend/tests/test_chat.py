import json
from types import SimpleNamespace

import pytest

from chat import ChatState, GEData, local_parse
from import_ge_data import install


@pytest.fixture
def chat_client(client, tmp_path):
    catalog = client.app.state.catalog
    for course in catalog.courses:
        course["campus"] = "บางเขน"
        for section in course["sections"]:
            section["campus"] = "บางเขน"
    payload = {
        "dataset_version": "test-v1",
        "source_url": "demo://test",
        "updated_at": "2026-10-24",
        "courses": [
            {
                "subject_code": c["subject_code"],
                "groups": ["อยู่ดีมีสุข"],
                "competencies": [4],
                "status": "mock",
            }
            for c in catalog.courses
        ],
        "offerings": [
            {
                "subject_code": "001-61",
                "section_id": "s001-61",
                "offered": True,
                "remaining": 2,
                "programs": ["regular"],
                "status": "mock",
            }
        ],
    }
    path = tmp_path / "ge.json"
    path.write_text(json.dumps(payload))
    client.app.state.ge = GEData(catalog, path)
    return client


def ask(client, message, **kwargs):
    return client.post("/chat", json={"message": message, "dataset_version": "test-v1", **kwargs})


def test_followup_and_reset():
    state = local_parse("สนใจภาษา", ChatState())
    state = local_parse("เฉพาะวันศุกร์ 09:00-16:00", state)
    assert state.interest == "ภาษา"
    assert state.days == ["Fri"]
    assert (state.start_time, state.end_time) == ("09:00", "16:00")
    assert local_parse("เริ่มใหม่", state) == ChatState()


def test_curriculum_is_not_course_code_suffix():
    state = local_parse("กลุ่มสาระ 64 อยู่ดีมีสุข", ChatState())
    state = local_parse("สมรรถนะ 67 ด้าน 4", state)
    assert (state.curriculum, state.competency, state.group) == ("67", 4, None)
    assert local_parse("กลุ่มสาระ 64", state).competency is None


def test_category_names_are_not_accidentally_used_as_interest():
    for message in ["อยู่ดีมีสุข", "ด้านภาวะผู้นำ", "ภาษากับการสื่อสาร"]:
        assert local_parse(message, ChatState()).interest == ""
    assert local_parse("ว่างทุกวันยกเว้นวันจันทร์", ChatState()).days == [
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
    ]


def test_full_section_must_fit_and_context_preserved(chat_client):
    first = ask(chat_client, "ค้นหา Programming").json()
    assert first["total_results"] == 2
    second = ask(chat_client, "ว่างวันจันทร์ 09:00-12:00", state=first["state"]).json()
    assert [r["course"]["subject_code"] for r in second["results"]] == ["002-61"]
    assert second["state"]["interest"] == "programming"


def test_mock_status_eligibility_and_conflict(chat_client):
    result = ask(chat_client, "ค้นหา Programming ภาคปกติ").json()
    section = next(r for r in result["results"] if r["course"]["subject_code"] == "001-61")[
        "sections"
    ][0]
    assert section["offering"]["status"] == "mock"
    assert section["eligibility"] == "program_matches"  # Never 'eligible'.
    special = ask(chat_client, "ภาคพิเศษ", state=result["state"]).json()
    section = next(r for r in special["results"] if r["course"]["subject_code"] == "001-61")[
        "sections"
    ][0]
    assert section["eligibility"] == "program_mismatch"
    assert not section["can_plan"]
    collision = ask(
        chat_client, "ค้นหา Calculus", items=[{"subject_code": "001-61", "section_id": "s001-61"}]
    ).json()
    assert collision["results"][0]["sections"][0]["conflicts"]
    assert not collision["results"][0]["sections"][0]["can_plan"]


def test_capacity_and_offering_status_block_demo_planning(chat_client):
    offering = chat_client.app.state.ge.offerings[("001-61", "s001-61")]
    for changes in [{"remaining": 0}, {"remaining": 1, "offered": False}]:
        offering.update(changes)
        data = ask(chat_client, "ค้นหา Programming").json()
        section = next(r for r in data["results"] if r["course"]["subject_code"] == "001-61")[
            "sections"
        ][0]
        assert not section["can_plan"]


def test_bangkhen_only_and_unknown_is_not_closed(chat_client):
    catalog = chat_client.app.state.catalog
    catalog.by_code["001-61"]["campus"] = "กำแพงแสน"
    result = ask(chat_client, "ค้นหา Programming").json()
    assert result["total_results"] == 1
    section = result["results"][0]["sections"][0]
    assert section["offering"] is None
    assert section["eligibility"] == "unknown"


@pytest.mark.parametrize("message", ["ว่างวันจันทร์ 18:00-09:00", " "])
def test_invalid_input_does_not_change_timetable(chat_client, message):
    assert ask(chat_client, message).status_code == 422


def test_version_and_invalid_refs(chat_client):
    assert (
        chat_client.post("/chat", json={"message": "hello", "dataset_version": "old"}).status_code
        == 409
    )
    assert (
        ask(
            chat_client, "hello", items=[{"subject_code": "FAKE", "section_id": "oops"}]
        ).status_code
        == 422
    )


def test_local_model_failure_falls_back(chat_client, monkeypatch):
    import chat

    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")

    def offline(*args, **kwargs):
        raise OSError("offline")

    monkeypatch.setattr(chat, "urlopen", offline)
    assert ask(chat_client, "ค้นหา Programming").json()["engine"] == "local-rules-fallback"


def test_local_model_validated(chat_client, monkeypatch):
    import io

    import chat

    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")
    monkeypatch.setattr(
        chat,
        "urlopen",
        lambda *a, **k: io.BytesIO(json.dumps({"response": '{"interest":"Calculus"}'}).encode()),
    )
    result = ask(chat_client, "หาเลขให้หน่อย").json()
    assert result["engine"] == "ollama"
    assert result["results"][0]["course"]["subject_code"] == "003-61"


def test_export_validation_is_atomic(tmp_path):
    source = tmp_path / "source.json"
    source.write_text('{"dataset_version":"wrong"}')
    destination = tmp_path / "installed.json"
    destination.write_text("original")
    catalog_path = tmp_path / "catalog.json"
    catalog_path.write_text(json.dumps({"metadata": {"dataset_version": "test"}, "courses": []}))
    with pytest.raises(ValueError):
        install(source, catalog_path, destination)
    assert destination.read_text() == "original"


def test_export_rejects_mismatched_snapshot_and_unknown_identity(tmp_path):
    path = tmp_path / "export.json"
    payload = {
        "dataset_version": "wrong",
        "source_url": "demo://test",
        "updated_at": "2026-10-24",
        "courses": [],
    }
    catalog = SimpleNamespace(metadata={"dataset_version": "test"}, by_code={})
    path.write_text(json.dumps(payload))
    with pytest.raises(ValueError, match="different catalog"):
        GEData(catalog, path)
    payload.update(dataset_version="test", courses=[{"subject_code": "FAKE"}])
    path.write_text(json.dumps(payload))
    with pytest.raises(ValueError, match="Unknown GE course"):
        GEData(catalog, path)


def test_english_ui_chat_preferences_keep_context():
    first = local_parse("Interested in languages", ChatState())
    assert first.interest == "ภาษา"
    second = local_parse("Friday only 09:00-16:00", first)
    assert second.days == ["Fri"]
    assert second.start_time == "09:00"
    assert second.end_time == "16:00"
    assert second.interest == "ภาษา"
    assert local_parse("any day", second).days == []
    assert local_parse("regular program", second).program == "regular"
    assert local_parse("Competencies 67, area 4", ChatState()).competency == 4
