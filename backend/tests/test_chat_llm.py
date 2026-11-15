import io
import json
from urllib.error import HTTPError, URLError

import pytest

import chat_llm


@pytest.mark.parametrize(
    ("error", "reason", "status"),
    [
        (TimeoutError("sensitive timeout detail"), "timeout", None),
        (URLError(TimeoutError("sensitive timeout detail")), "timeout", None),
        (URLError("sensitive endpoint"), "connection_error", None),
        (
            HTTPError("https://private.example", 401, "secret body", {}, None),
            "provider_http_error",
            401,
        ),
        (
            HTTPError("https://private.example", 429, "secret body", {}, None),
            "provider_http_error",
            429,
        ),
        (json.JSONDecodeError("secret body", "private conversation", 0), "invalid_json", None),
        (ValueError("private conversation"), "invalid_response", None),
    ],
)
def test_failure_diagnostics_do_not_expose_sensitive_details(error, reason, status, caplog):
    details = chat_llm.failure_details(error, "understanding")
    assert details == {
        "stage": "understanding",
        "reason": reason,
        **({"http_status": status} if status else {}),
    }
    assert reason in caplog.text
    for private in ["sensitive", "private", "secret"]:
        assert private not in caplog.text
        assert private not in json.dumps(details)


def test_hosted_transport_and_credentials_stay_server_side(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setenv("LLM_BASE_URL", "https://api.opentyphoon.ai/v1/")
    monkeypatch.setenv("CHAT_OLLAMA_MODEL", "unused")
    requests = []

    def transport(request, timeout):
        requests.append(request)
        assert timeout == 18
        return io.BytesIO(
            json.dumps({"choices": [{"message": {"content": '{"ok":true}'}}]}).encode()
        )

    monkeypatch.setattr(chat_llm, "urlopen", transport)
    assert chat_llm.structured([{"role": "user", "content": "hi"}], {}) == {"ok": True}
    assert requests[0].full_url == "https://api.opentyphoon.ai/v1/chat/completions"
    assert requests[0].get_header("Authorization") == "Bearer test-key"
    assert json.loads(requests[0].data)["model"] == "test-model"
    assert "test-key" not in requests[0].data.decode()


def test_cloud_key_is_not_sent_over_plain_http(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setenv("LLM_BASE_URL", "http://example.com/v1")
    with pytest.raises(ValueError, match="HTTPS"):
        chat_llm.complete([])


def test_local_config_and_environment_precedence(monkeypatch, tmp_path):
    path = tmp_path / "chat.local.toml"
    path.write_text('api_key = "local-test-key"\nmodel = "local-model"\n')
    monkeypatch.setattr(chat_llm, "CONFIG_PATH", path)
    assert chat_llm.provider() == "llm-api"
    assert chat_llm.settings()["model"] == "local-model"
    monkeypatch.setenv("LLM_MODEL", "environment-model")
    assert chat_llm.settings()["model"] == "environment-model"


def test_invalid_local_config_falls_back_without_exposing_it(monkeypatch, tmp_path):
    path = tmp_path / "chat.local.toml"
    path.write_text("api_key = invalid-toml")
    monkeypatch.setattr(chat_llm, "CONFIG_PATH", path)
    assert chat_llm.provider() is None
