import json
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from feedback import FeedbackService, Store


def chat_answer(client, question="ว่างวันศุกร์ 16:00-09:00"):
    return client.post("/chat", json={"message": question, "dataset_version": "test-v1"}).json()


def submit(client, training=True, **changes):
    answer = chat_answer(client)
    body = {
        "receipt": answer["feedback_receipt"],
        "rating": "not_helpful",
        "category": "understanding",
        "comment": "ควรถามยืนยันเวลา ไม่ควรเดา",
        "consent": True,
        "allow_training": training,
    }
    body.update(changes)
    return client.post("/feedback", json=body), body


def headers(client):
    return {"X-Feedback-Review-Key": client.app.state.feedback.review_key}


def review_body(version=1, decision="approved"):
    return {
        "expected_version": version,
        "decision": decision,
        "reviewer": "Reviewer A",
        "review_note": "Verified literal time against the source message; removed personal information",
        "training_input": "User is free Friday 16:00–09:00. Ask for clarification before searching.",
        "corrected_answer": "Did you mean until the next morning, or a different end time?",
        "source_checked": True,
        "privacy_checked": True,
    }


def test_chat_does_not_store_conversations_without_feedback_consent(client):
    answer = chat_answer(client)
    assert answer["feedback_receipt"]
    assert client.app.state.feedback.store.list("pending", 100) == []
    assert client.get("/feedback/config").json() == {"enabled": True, "automatic_training": False}
    response, _ = submit(client, consent=False)
    assert response.status_code == 422
    assert client.app.state.feedback.store.list("pending", 100) == []


def test_feedback_is_pending_even_for_positive_rating_and_deduplicates(client):
    response, body = submit(client, rating="helpful", comment="Good")
    assert response.status_code == 200
    assert response.json()["status"] == "pending"
    repeat = client.post("/feedback", json={**body, "allow_training": False})
    assert repeat.json()["id"] == response.json()["id"]
    queue = client.get("/feedback/review", headers=headers(client)).json()["items"]
    assert len(queue) == 1
    assert queue[0]["snapshot"]["question"] == "ว่างวันศุกร์ 16:00-09:00"
    assert queue[0]["snapshot"]["prompt_version"]
    assert queue[0]["reviewer"] == ""


def test_negative_feedback_requires_explanation(client):
    response, _ = submit(client, comment="  ")
    assert response.status_code == 422


def test_tampered_and_expired_receipts_are_rejected(client):
    _, body = submit(client)
    token = body["receipt"]
    payload = jwt.decode(token, options={"verify_signature": False})
    payload["answer"] = "Invented answer supplied by the browser"
    forged = jwt.encode(payload, "another-key-that-is-long-enough-to-use", algorithm="HS256")
    assert client.post("/feedback", json={**body, "receipt": forged}).status_code == 400
    payload["exp"] = datetime.now(UTC) - timedelta(minutes=1)
    expired = jwt.encode(payload, client.app.state.feedback.signing_secret, algorithm="HS256")
    assert client.post("/feedback", json={**body, "receipt": expired}).status_code == 400


def test_review_and_export_require_server_only_review_key(client):
    created, _ = submit(client)
    ident = created.json()["id"]
    for method, path in [
        ("get", "/feedback/review"),
        ("get", f"/feedback/review/{ident}"),
        ("get", "/feedback/export?split=train"),
    ]:
        response = getattr(client, method)(path)
        assert response.status_code == 403
        assert response.headers["cache-control"] == "no-store"
        assert "16:00" not in response.text
    assert client.put(f"/feedback/review/{ident}", json=review_body()).status_code == 403
    assert (
        client.get("/feedback/review", headers={"X-Feedback-Review-Key": "wrong"}).status_code
        == 403
    )


def test_approval_requires_corrected_example_and_both_checks(client):
    created, _ = submit(client)
    path = f"/feedback/review/{created.json()['id']}"
    for changes in [
        {"source_checked": False},
        {"privacy_checked": False},
        {"training_input": " "},
        {"corrected_answer": " "},
        {"review_note": " "},
    ]:
        assert (
            client.put(path, headers=headers(client), json={**review_body(), **changes}).status_code
            == 422
        )
    assert client.get(path, headers=headers(client)).json()["status"] == "pending"


def test_only_approved_consented_corrected_examples_export_with_held_out_split(client):
    created, _ = submit(client)
    ident = created.json()["id"]
    assert client.get("/feedback/export?split=train", headers=headers(client)).text == ""
    updated = client.put(f"/feedback/review/{ident}", headers=headers(client), json=review_body())
    assert updated.status_code == 200
    row = updated.json()
    assert row["status"] == "approved" and row["version"] == 2
    assert len(row["reviews"]) == 1
    response = client.get(f"/feedback/export?split={row['dataset_split']}", headers=headers(client))
    example = json.loads(response.text)
    assert example["messages"][1]["content"] == review_body()["training_input"]
    assert example["messages"][2]["content"] == review_body()["corrected_answer"]
    assert (
        "ควรถามยืนยันเวลา" not in response.text
    )  # Raw user feedback is not appended to training input.
    other = "eval" if row["dataset_split"] == "train" else "train"
    assert client.get(f"/feedback/export?split={other}", headers=headers(client)).text == ""
    assert response.headers["cache-control"] == "no-store"
    assert (
        client.put(
            f"/feedback/review/{ident}", headers=headers(client), json=review_body()
        ).status_code
        == 409
    )
    revoked = client.put(
        f"/feedback/review/{ident}", headers=headers(client), json=review_body(2, "rejected")
    )
    assert len(revoked.json()["reviews"]) == 2
    assert (
        client.get(f"/feedback/export?split={row['dataset_split']}", headers=headers(client)).text
        == ""
    )


def test_training_consent_is_required_even_when_reviewer_approves(client):
    created, _ = submit(client, training=False)
    response = client.put(
        f"/feedback/review/{created.json()['id']}", headers=headers(client), json=review_body()
    )
    assert response.status_code == 200
    for split in ["train", "eval"]:
        assert client.get(f"/feedback/export?split={split}", headers=headers(client)).text == ""


def test_store_survives_reopening(client):
    created, _ = submit(client)
    store = Store(client.app.state.feedback.store.target)
    assert store.get(created.json()["id"])["status"] == "pending"


def test_production_feedback_never_falls_back_to_ephemeral_sqlite(monkeypatch, tmp_path):
    for name in [
        "FEEDBACK_DATABASE_URL",
        "POSTGRES_URL",
        "DATABASE_URL",
        "FEEDBACK_SIGNING_SECRET",
        "FEEDBACK_REVIEW_TOKEN",
    ]:
        monkeypatch.delenv(name, raising=False)
    assert FeedbackService.configured(True, tmp_path) is None
    assert list(tmp_path.iterdir()) == []
    monkeypatch.setenv("FEEDBACK_DATABASE_URL", str(tmp_path / "should-not-exist.sqlite"))
    monkeypatch.setenv("FEEDBACK_SIGNING_SECRET", "s" * 40)
    monkeypatch.setenv("FEEDBACK_REVIEW_TOKEN", "r" * 40)
    assert FeedbackService.configured(True, tmp_path) is None
    assert list(tmp_path.iterdir()) == []


def test_distinct_secrets_required(tmp_path):
    with pytest.raises(ValueError):
        FeedbackService(Store(tmp_path / "test.sqlite"), "same" * 10, "same" * 10)


def test_turns_from_same_conversation_stay_in_one_split(client):
    ids = []
    for message in ["ว่างวันศุกร์ 16:00-09:00", "ว่างวันจันทร์ 18:00-08:00"]:
        response = client.post(
            "/chat",
            json={
                "message": message,
                "dataset_version": "test-v1",
                "conversation_id": "test-conversation-1",
            },
        ).json()
        created = client.post(
            "/feedback",
            json={
                "receipt": response["feedback_receipt"],
                "rating": "helpful",
                "category": "understanding",
                "comment": "",
                "consent": True,
                "allow_training": True,
            },
        ).json()
        ids.append(created["id"])
    rows = [client.app.state.feedback.store.get(ident) for ident in ids]
    assert rows[0]["dataset_split"] == rows[1]["dataset_split"]
    assert rows[0]["snapshot"]["conversation_group"] == rows[1]["snapshot"]["conversation_group"]
    assert rows[0]["snapshot"]["jti"] != rows[1]["snapshot"]["jti"]


def test_exact_reviewed_prompt_in_eval_is_excluded_from_training(client):
    rows = []
    for _ in range(2):
        response, _ = submit(client)
        ident = response.json()["id"]
        client.put(f"/feedback/review/{ident}", headers=headers(client), json=review_body())
        rows.append(ident)
    store = client.app.state.feedback.store
    # Simulate duplicate examples received from two independently assigned conversations.
    with store.connect() as db:
        store.execute(db, "UPDATE chat_feedback SET dataset_split='train' WHERE id=?", (rows[0],))
        store.execute(db, "UPDATE chat_feedback SET dataset_split='eval' WHERE id=?", (rows[1],))
    assert client.get("/feedback/export?split=train", headers=headers(client)).text == ""
    assert (
        len(client.get("/feedback/export?split=eval", headers=headers(client)).text.splitlines())
        == 1
    )
