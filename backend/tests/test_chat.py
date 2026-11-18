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


def test_language_search_and_followup_use_one_llm_call_each(chat_client, monkeypatch):
    import chat

    catalog = chat_client.app.state.catalog
    chinese = catalog.by_code["005-61"]
    chinese.update(subject_name_th="ภาษาจีนเบื้องต้น", subject_name_en="Chinese")
    spanish = catalog.by_code["002-61"]
    spanish.update(subject_name_th="ภาษาสเปนเบื้องต้น", subject_name_en="Spanish")
    spanish["sections"][0]["time_slots"][0]["day"] = "Tue"
    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")
    calls = []

    def reply(messages, schema):
        assert "message" in schema["properties"] and "state" not in schema["properties"]
        calls.append(messages)
        context = json.loads(messages[-1]["content"])["retrieved_context"]
        code = context["courses"][0]["code"]
        return {"message": f"ลองดู {code} ในการ์ดรายวิชาครับ", "course_codes": [code]}

    monkeypatch.setattr(chat.chat_llm, "structured", reply)
    first = ask(chat_client, "อยากเรียนภาษาจีน ว่างเฉพาะวันอังคาร ศุกร์").json()
    assert first["engine"] == "ollama" and first["understanding_engine"] == "local-rules-fast"
    assert first["state"]["interest"] == "จีน"
    assert first["state"]["days"] == ["Tue", "Fri"]
    assert first["answer_sources"] == ["005-61"]
    second = ask(chat_client, "แล้วถ้าเป็นภาษาสเปนละ มีมั้ย", state=first["state"]).json()
    assert second["state"]["interest"] == "สเปน"
    assert second["state"]["days"] == ["Tue", "Fri"]
    assert second["answer_sources"] == ["002-61"]
    assert len(calls) == 2


@pytest.mark.parametrize(
    "message",
    [
        "อังกฤษแต่ไม่เอาวันศุกร์",
        "อังกฤษหลังบ่ายสอง",
        "ภาษาอังกฤษกับภาษาจีน",
        "ภาษาจีนต้องมีพื้นฐานไหม",
        "ภาษาสเปนง่ายกว่าอังกฤษมั้ย",
        "วันศุกร์ยกเว้นตอนเช้า",
    ],
)
def test_complex_questions_still_use_full_llm_understanding(message):
    from chat import fast_search_plan

    assert fast_search_plan(message, ChatState()) is None


def test_fast_no_matches_does_not_claim_llm_failed(chat_client, monkeypatch):
    import chat

    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")

    def unexpected(*args):
        raise AssertionError("No LLM needed for a clear search with zero matches")

    monkeypatch.setattr(chat.chat_llm, "structured", unexpected)
    data = ask(chat_client, "อยากเรียนภาษาสเปน").json()
    assert data["engine"] == "local-rules-fast" and data["llm_failure"] is None
    assert data["total_results"] == 0 and "สเปน" in data["message"]


def test_quick_search_returns_before_llm_then_generates_grounded_answer(chat_client, monkeypatch):
    import chat

    catalog = chat_client.app.state.catalog
    catalog.by_code["005-61"].update(subject_name_th="ภาษาจีน", subject_name_en="Chinese")
    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")
    calls = []

    def reply(messages, schema):
        calls.append(messages)
        return {"message": "ดูรายละเอียดวิชา 005-61 ในการ์ดครับ", "course_codes": ["005-61"]}

    monkeypatch.setattr(chat.chat_llm, "structured", reply)
    body = {"message": "อยากเรียนภาษาจีน วันอังคาร ศุกร์", "dataset_version": "test-v1"}
    quick = chat_client.post("/chat?quick=true", json=body).json()
    assert quick["answer_pending"] and quick["total_results"] == 1
    assert quick["feedback_receipt"] is None and quick["engine"] == "local-rules-fast"
    assert quick["message"].startswith("ผมเข้าใจ") and not calls
    final = chat_client.post("/chat", json=body).json()
    assert final["engine"] == "ollama" and not final.get("answer_pending")
    assert final["answer_sources"] == ["005-61"] and len(calls) == 1
    assert final["state"] == quick["state"]


def test_llm_patch_preserves_unchanged_filters_and_can_clear_them(monkeypatch):
    import chat

    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    seen = []

    def reply(messages, schema):
        seen.append(json.loads(messages[-1]["content"])["previous_state"])
        return {"state": {"interest": "อังกฤษ", "end_time": None}}

    monkeypatch.setattr(chat.chat_llm, "structured", reply)
    previous = ChatState(interest="ญี่ปุ่น", days=["Fri"], end_time="17:00")
    plan, engine = chat.parse("เปลี่ยนเป็นอังกฤษ ไม่จำกัดเวลาสิ้นสุด", previous)
    assert engine == "llm-api"
    assert plan.state.interest == "อังกฤษ"
    assert plan.state.days == ["Fri"] and plan.state.end_time is None
    assert "faculty" not in seen[0]


@pytest.mark.parametrize("message", ["เปลี่ยนเป็นวันจันทร์แทน", "Monday instead"])
def test_llm_day_followup_cannot_erase_previous_time_window(monkeypatch, message):
    import chat

    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setattr(
        chat.chat_llm,
        "structured",
        lambda *args: {
            "state": {"days": ["Mon"], "start_time": None, "end_time": None},
        },
    )
    previous = ChatState(interest="อังกฤษ", days=["Fri"], start_time="12:00", end_time="17:00")
    plan, engine = chat.parse(message, previous)
    assert engine == "llm-api"
    assert plan.state.days == ["Mon"] and plan.state.interest == "อังกฤษ"
    assert (plan.state.start_time, plan.state.end_time) == ("12:00", "17:00")


@pytest.mark.parametrize("message", ["ทุกเวลา", "ไม่จำกัดเวลา", "any time"])
def test_llm_can_still_explicitly_clear_time_window(monkeypatch, message):
    import chat

    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setattr(
        chat.chat_llm,
        "structured",
        lambda *args: {
            "state": {"start_time": None, "end_time": None},
        },
    )
    previous = ChatState(start_time="12:00", end_time="17:00")
    plan, engine = chat.parse(message, previous)
    assert engine == "llm-api"
    assert plan.state.start_time is None and plan.state.end_time is None


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


@pytest.mark.parametrize("message", [" "])
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

    monkeypatch.setattr(chat.chat_llm, "urlopen", offline)
    data = ask(chat_client, "ช่วยแนะนำวิชาเกี่ยวกับ Programming").json()
    assert data["engine"] == "local-rules-fallback"
    assert data["llm_failure"] == {"stage": "understanding", "reason": "connection_error"}


def test_understanding_timeout_is_identifiable_without_leaking_input(chat_client, monkeypatch):
    import chat

    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")

    def timeout(*args, **kwargs):
        raise TimeoutError("private provider detail")

    monkeypatch.setattr(chat.chat_llm, "structured", timeout)
    data = ask(chat_client, "ช่วยแนะนำวิชาเกี่ยวกับ Programming").json()
    assert data["llm_failure"] == {"stage": "understanding", "reason": "timeout"}
    assert data["total_results"] == 2
    assert "private provider detail" not in json.dumps(data)


def test_local_model_validated(chat_client, monkeypatch):
    import io

    import chat

    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")
    replies = iter(
        [
            {"state": {"interest": "Calculus"}, "intent": "search"},
            {"message": "ลองดู Calculus รหัส 003-61 ครับ", "course_codes": ["003-61"]},
        ]
    )
    monkeypatch.setattr(
        chat.chat_llm,
        "urlopen",
        lambda *a, **k: io.BytesIO(
            json.dumps(
                {
                    "message": {"content": json.dumps(next(replies))},
                }
            ).encode()
        ),
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


def test_llm_uses_history_and_grounded_context(chat_client, monkeypatch):
    import chat

    monkeypatch.setenv("LLM_API_KEY", "test-only")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    calls = []

    def reply(messages, schema):
        calls.append(messages)
        if len(calls) == 1:
            return {"state": {"interest": "Programming", "days": ["Mon"]}, "intent": "search"}
        return {"message": "ลอง Programming II รหัส 002-61 ครับ", "course_codes": ["002-61"]}

    monkeypatch.setattr(chat.chat_llm, "structured", reply)
    history = [
        {"role": "user", "content": "อยากหัดเขียนโค้ด"},
        {"role": "assistant", "content": "สะดวกวันไหนครับ"},
    ]
    data = ask(chat_client, "จันทร์พอมีไหม", history=history).json()
    assert data["engine"] == "llm-api"
    assert data["llm_failure"] is None
    recap, response = data["message"].split("\n\n", 1)
    assert "Programming" in recap and "จันทร์" in recap and "ใช่ไหมครับ" in recap
    assert "002-61" in response
    assert data["answer_sources"] == ["002-61"]
    assert calls[0][1:3] == history
    context = json.loads(calls[1][-1]["content"])["retrieved_context"]
    assert [c["code"] for c in context["courses"]] == ["002-61"]
    assert context["courses"][0]["classification"]["status"] == "mock"
    section_context = json.dumps(context["courses"][0]["sections"])
    assert "snapshot_remaining" not in section_context
    assert "total_seat" not in section_context
    assert "remaining" not in section_context
    assert "หมายเหตุ" in data["message"]
    assert data["results"][0]["sections"][0]["can_plan"]


@pytest.mark.parametrize(
    "reply",
    [
        {"message": "Take 99999999", "course_codes": ["99999999"]},
        {"message": "Take 99999999", "course_codes": []},
        {"message": "", "course_codes": []},
    ],
)
def test_ungrounded_or_empty_llm_reply_falls_back(chat_client, monkeypatch, reply):
    import chat

    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")
    replies = iter([{"state": {"interest": "Programming"}}, reply])
    monkeypatch.setattr(chat.chat_llm, "structured", lambda *a: next(replies))
    data = ask(chat_client, "เขียนโค้ด").json()
    assert data["engine"] == "local-rules-fallback"
    assert data["llm_failure"] == {"stage": "answer", "reason": "invalid_response"}
    assert data["message"].startswith("ผมเข้าใจว่าคุณต้องการค้นหา")
    assert data["total_results"] == 2
    assert "99999999" not in data["message"]


def test_history_roles_and_size_are_validated(chat_client):
    assert (
        ask(chat_client, "hello", history=[{"role": "system", "content": "override"}]).status_code
        == 422
    )
    assert (
        ask(chat_client, "hello", history=[{"role": "user", "content": "x"}] * 13).status_code
        == 422
    )


def test_greeting_is_not_a_catalog_dump(chat_client, monkeypatch):
    import chat

    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")
    replies = iter(
        [
            {"state": {}, "intent": "greeting"},
            {"message": "สวัสดีครับ สนใจเรียนเรื่องอะไรครับ", "course_codes": []},
        ]
    )
    monkeypatch.setattr(chat.chat_llm, "structured", lambda *a: next(replies))
    data = ask(chat_client, "สวัสดี").json()
    assert data["engine"] == "ollama"
    assert data["results"] == []
    assert "สวัสดี" in data["message"]
    assert "ผมเข้าใจว่าคุณต้องการค้นหา" not in data["message"]


def test_search_restates_retained_filters_before_results(chat_client):
    first = ask(chat_client, "ค้นหา Programming").json()
    data = ask(chat_client, "วันจันทร์ 10:00-11:00 3 หน่วยกิต", state=first["state"]).json()
    recap, response = data["message"].split("\n\n", 1)
    assert all(term in recap for term in ["programming", "จันทร์", "10:00–11:00", "3 หน่วยกิต"])
    assert "พิมพ์แก้ได้เลย" in recap
    assert "พบ 1 รายวิชา" in response
    assert data["results"][0]["course"]["subject_code"] == "002-61"


def test_no_matches_still_restates_understanding(chat_client):
    data = ask(chat_client, "วันศุกร์", state={"interest": "Programming"}).json()
    recap, response = data["message"].split("\n\n", 1)
    assert "Programming" in recap and "ศุกร์" in recap
    assert "ยังไม่พบ" in response
    assert data["results"] == []


def test_reset_recap_drops_previous_filters(chat_client):
    data = ask(chat_client, "เริ่มใหม่", state={"interest": "ญี่ปุ่น", "days": ["Fri"]}).json()
    recap = data["message"].split("\n\n", 1)[0]
    assert "บางเขน" in recap
    assert "ญี่ปุ่น" not in recap and "ศุกร์" not in recap
    assert data["state"] == ChatState().model_dump()


def test_english_recap_uses_resolved_filters(chat_client):
    data = ask(chat_client, "Monday before 11:00", language="en").json()
    recap, response = data["message"].split("\n\n", 1)
    assert "Monday" in recap and "ending no later than 11:00" in recap
    assert "Is that right?" in recap and "please correct me" in recap
    assert "I found" in response


def test_recap_distinguishes_ge_and_snapshot_filters(chat_client):
    data = ask(
        chat_client,
        "เฉพาะวิชา GE",
        state={
            "curriculum": "67",
            "competency": 4,
            "program": "special",
            "offered_only": True,
            "faculty": "Science",
            "min_credits": 2,
            "max_credits": 4,
        },
    ).json()
    recap = data["message"].split("\n\n", 1)[0]
    assert all(
        term in recap
        for term in [
            "หลักสูตร GE 67",
            "สมรรถนะที่ 4",
            "ภาคพิเศษ",
            "Science",
            "2–4 หน่วยกิต",
            "เฉพาะวิชาที่ยืนยันว่าเป็น GE",
            "มีหมู่เรียนใน snapshot",
        ]
    )
    assert "เปิดสอนปัจจุบัน" not in recap


def test_hybrid_retrieval_respects_schedule_and_ge_scope(chat_client, monkeypatch):
    catalog = chat_client.app.state.catalog
    catalog.model = object()
    catalog.embeddings = object()
    monkeypatch.setattr(catalog, "semantic", lambda *a: [(0, 0.9), (1, 0.8)])
    data = ask(chat_client, "ค้นหา software", state={"days": ["Mon"]}).json()
    assert data["retrieval"] == "hybrid"
    assert [r["course"]["subject_code"] for r in data["results"]] == ["002-61"]
    monkeypatch.setattr(catalog, "semantic", lambda *a: (_ for _ in ()).throw(RuntimeError()))
    data = ask(chat_client, "ค้นหา Programming").json()
    assert data["retrieval"] == "keyword-fallback"
    assert data["total_results"] == 2


@pytest.mark.parametrize("interest", ["ฝึกภาษาอังกฤษ", "อยากพัฒนาภาษาอังกฤษ", "practise English"])
def test_conversational_english_interest_matches_catalog(chat_client, interest):
    course = chat_client.app.state.catalog.by_code["001-61"]
    course["subject_name_th"] = "ภาษาอังกฤษในชีวิตประจำวัน"
    course["subject_name_en"] = "English for Everyday Life"
    data = ask(chat_client, "แนะนำวิชาตามเงื่อนไข", state={"interest": interest}).json()
    assert [r["course"]["subject_code"] for r in data["results"]] == ["001-61"]
    # Preserve constraints: a Mon-only course must not be returned for Friday.
    data = ask(chat_client, "เฉพาะวันศุกร์", state={"interest": interest}).json()
    assert data["total_results"] == 0


@pytest.mark.parametrize("times", ["16:00-09:00", "16:00–09:00", "16:00 ถึง 09:00", "16:00-16:00"])
def test_reversed_time_asks_before_model_or_search(chat_client, monkeypatch, times):
    import chat

    def must_not_call(*args, **kwargs):
        raise AssertionError("Ambiguous times must not be sent to a model")

    monkeypatch.setattr(chat.chat_llm, "structured", must_not_call)
    previous = {"interest": "ญี่ปุ่น", "days": ["Mon"], "start_time": "09:00", "end_time": "12:00"}
    data = ask(chat_client, f"ว่างวันศุกร์ {times} มีวิชาไหนเปิดบ้าง", state=previous).json()
    assert data["needs_clarification"]
    assert data["retrieval"] == "not-run"
    assert data["state"]["days"] == ["Mon"]
    assert data["state"]["end_time"] == "12:00"
    assert data["state"]["interest"] == "ญี่ปุ่น"
    assert "21:00" not in data["message"]
    assert data["results"] == []


def test_model_cannot_silently_rewrite_valid_literal_times(chat_client, monkeypatch):
    import chat

    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")
    monkeypatch.setattr(
        chat.chat_llm,
        "structured",
        lambda *a: {
            "state": {"start_time": "12:00", "end_time": "21:00"},
            "intent": "search",
        },
    )
    plan, engine = chat.parse("Friday 16:00-19:00", chat.ChatState())
    assert engine == "ollama"
    assert plan.state.start_time == "16:00"
    assert plan.state.end_time == "19:00"


def test_no_matches_does_not_generate_unsupported_alternatives(chat_client, monkeypatch):
    import chat

    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")
    calls = []

    def plan_only(*a):
        calls.append(a)
        return {"state": {"interest": "ญี่ปุ่น", "days": ["Fri"]}, "intent": "search"}

    monkeypatch.setattr(chat.chat_llm, "structured", plan_only)
    data = ask(chat_client, "วันศุกร์มีอะไรบ้าง", state={"interest": "ญี่ปุ่น"}).json()
    assert len(calls) == 1
    assert data["total_results"] == 0
    assert "ญี่ปุ่น" in data["message"]
    assert "เริ่มใหม่" in data["message"]
    assert "ศิลปศาสตร์" not in data["message"]


def japanese_fixture(client):
    catalog = client.app.state.catalog
    course = catalog.by_code["002-61"]
    course.update(subject_name_th="ภาษาญี่ปุ่นเบื้องต้น I", subject_name_en="Basic Japanese I")
    course["sections"][0]["time_slots"] = [
        {"day": "Fri", "start": "16:00", "end": "19:00", "location": None}
    ]
    client.app.state.ge.courses.pop("002-61")
    return course


def test_japanese_transcript_with_invalid_time_and_topic_switch(chat_client):
    japanese_fixture(chat_client)
    first = ask(chat_client, "อยากเรียนภาษาญี่ปุ่น มีเปิดวันไหนบ้าง").json()
    assert first["state"]["interest"] == "ญี่ปุ่น"
    assert first["total_results"] == 1
    row = first["results"][0]
    assert row["classification"]["status"] == "unknown"
    assert row["sections"][0]["section"]["time_slots"][0]["day"] == "Fri"
    assert row["sections"][0]["can_plan"]
    for message in ["ว่างวันศุกร์ 16:00-09:00", "ว่างวันศุกร์ 16:00-09:00 มีวิชาไหนเปิดบ้าง"]:
        invalid = ask(chat_client, message, state=first["state"]).json()
        assert invalid["needs_clarification"]
        assert invalid["state"] == first["state"]
        assert "21:00" not in invalid["message"]
    fixed = ask(chat_client, "หมายถึงวันศุกร์ 16:00-19:00", state=invalid["state"]).json()
    assert fixed["state"]["interest"] == "ญี่ปุ่น"
    assert fixed["state"]["days"] == ["Fri"]
    assert fixed["state"]["end_time"] == "19:00"
    assert fixed["total_results"] == 1
    assert fixed["search_context"]["interest"] == "ญี่ปุ่น"
    any_course = ask(chat_client, "ขอทุกวิชา ไม่จำกัดความสนใจ", state=fixed["state"]).json()
    assert any_course["state"]["interest"] == ""
    assert any_course["state"]["days"] == ["Fri"]
    assert any_course["state"]["start_time"] == "16:00"


def test_verified_ge_filter_keeps_unknown_and_mock_separate(chat_client):
    japanese_fixture(chat_client)
    chat_client.app.state.ge.courses["003-61"]["status"] = "verified"
    data = ask(chat_client, "เฉพาะ GE").json()
    assert data["state"]["verified_ge_only"]
    assert [row["course"]["subject_code"] for row in data["results"]] == ["003-61"]
    assert data["results"][0]["classification"]["status"] == "verified"
    unknown = ask(chat_client, "อยากเรียนภาษาญี่ปุ่น", state={"verified_ge_only": True}).json()
    assert unknown["total_results"] == 0
    unrestricted = ask(chat_client, "ทุกวิชา", state=unknown["state"]).json()
    assert not unrestricted["state"]["verified_ge_only"]
    assert "002-61" in [row["course"]["subject_code"] for row in unrestricted["results"]]


def test_category_filters_do_not_classify_unknown_courses_as_ge(chat_client):
    japanese_fixture(chat_client)
    data = ask(chat_client, "อยากเรียนภาษาญี่ปุ่น", state={"curriculum": "64"}).json()
    assert data["total_results"] == 0


def test_chat_catalog_works_when_ge_export_is_missing(chat_client):
    japanese_fixture(chat_client)
    chat_client.app.state.ge = None
    data = ask(chat_client, "อยากเรียนภาษาญี่ปุ่น").json()
    assert data["total_results"] == 1
    assert data["results"][0]["classification"]["status"] == "unknown"
    assert data["sources"]["ge"]["status"] == "unavailable"


def test_hybrid_candidates_include_courses_outside_ge(chat_client, monkeypatch):
    japanese_fixture(chat_client)
    catalog = chat_client.app.state.catalog
    catalog.model = catalog.embeddings = object()
    calls = []

    def semantic(query, indices, threshold):
        calls.append(indices)
        return [(1, 0.9)] if 1 in indices else []

    monkeypatch.setattr(catalog, "semantic", semantic)
    data = ask(chat_client, "ค้นหา conversation", state={"days": ["Fri"]}).json()
    assert 1 in calls[0]
    assert data["retrieval"] == "hybrid"
    assert [row["course"]["subject_code"] for row in data["results"]] == ["002-61"]
    chat_client.app.state.ge.courses["003-61"]["status"] = "verified"
    ask(chat_client, "ค้นหา conversation", state={"verified_ge_only": True})
    assert calls[-1] == [2]


def test_grounding_summarizes_all_matching_sections_not_only_first_two(chat_client, monkeypatch):
    import chat

    japanese_fixture(chat_client)
    c = chat_client.app.state.catalog.by_code["002-61"]
    original = c["sections"][0]
    import copy

    for i, day in enumerate(["Mon", "Tue"], 2):
        section = copy.deepcopy(original)
        section["section_id"] = f"extra-{i}"
        section["section_code"] = str(i)
        section["time_slots"][0]["day"] = day
        c["sections"].append(section)
    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")
    captured = []

    def reply(messages, schema):
        if not captured:
            captured.append("plan")
            return {"state": {"interest": "ญี่ปุ่น"}, "intent": "search"}
        context = json.loads(messages[-1]["content"])["retrieved_context"]
        captured.append(context)
        return {
            "message": "002-61 มีตารางใน snapshot จันทร์ อังคาร ศุกร์ ยังไม่ยืนยัน GE",
            "course_codes": ["002-61"],
        }

    monkeypatch.setattr(chat.chat_llm, "structured", reply)
    data = ask(chat_client, "อยากเรียนญี่ปุ่น มีวันไหนบ้าง").json()
    assert data["engine"] == "ollama"
    context = captured[-1]["courses"][0]
    assert context["classification"]["status"] == "unknown"
    assert len(context["sections"]) == 2
    assert {entry[0] for entry in context["schedule_summary"]} == {"Mon", "Tue", "Fri"}
    assert context["matching_sections"] == 3


def test_llm_cannot_silently_narrow_japanese_to_verified_ge(chat_client, monkeypatch):
    import chat

    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")
    monkeypatch.setattr(
        chat.chat_llm,
        "structured",
        lambda *a: {
            "state": {"interest": "ญี่ปุ่น", "verified_ge_only": True},
            "intent": "search",
        },
    )
    plan, _ = chat.parse("อยากเรียนภาษาญี่ปุ่น", chat.ChatState())
    assert not plan.state.verified_ge_only


def test_pasted_course_title_bypasses_interpretation_and_explains_filters(chat_client, monkeypatch):
    import chat

    course = chat_client.app.state.catalog.by_code["001-61"]
    course["subject_name_th"] = "การเขียนโปรแกรมเบื้องต้น"
    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "test")

    def unexpected(*args):
        raise AssertionError("Exact catalog lookup must work before AI")

    monkeypatch.setattr(chat.chat_llm, "structured", unexpected)
    payload = {"message": "การเขียน\u200bโปรแกรมเบื้องต้น", "dataset_version": "test-v1"}
    direct = chat_client.post("/chat?quick=true", json=payload).json()
    assert direct["results"][0]["course"]["subject_code"] == "001-61"
    assert direct["answer_pending"]
    filtered = ask(chat_client, payload["message"], state={"days": ["Fri"]}).json()
    assert not filtered["results"]
    assert "พบวิชานี้ในแค็ตตาล็อกบางเขน" in filtered["message"]


def test_career_guidance_both_directions_without_model(chat_client):
    course = chat_client.app.state.catalog.by_code["001-61"]
    course["subject_name_th"] = "การเขียนโปรแกรมเบื้องต้น"
    goal = ask(chat_client, "เรียนแล้วจบไป อยากเป็นโปรแกรมเมอร์ ควรเรียนวิชาไหนดี").json()
    assert goal["results"][0]["course"]["subject_code"] == "001-61"
    assert "ทักษะ" in goal["message"]
    reverse = ask(
        chat_client,
        "เรียนตัวนี้มาแล้ว ไปทำงานสายไหนได้บ้าง",
        state={"interest": "การเขียนโปรแกรมเบื้องต้น", "days": ["Fri"]},
    ).json()
    assert [row["course"]["subject_code"] for row in reverse["results"]] == ["001-61"]
    assert "นักพัฒนาซอฟต์แวร์" in reverse["message"]
    assert reverse["state"]["days"] == ["Fri"]
    unknown = ask(chat_client, "เรียนตัวนี้มาแล้ว ไปทำงานสายไหนได้บ้าง").json()
    assert not unknown["results"]
    assert "ชื่อ/รหัสวิชา" in unknown["message"]
