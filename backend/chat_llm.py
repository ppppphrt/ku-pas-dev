"""Bounded LLM transport. Credentials and endpoint configuration stay server-side."""

import json
import logging
import os
import tomllib
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path
from time import monotonic, sleep
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

CONFIG_PATH = Path(__file__).with_name("chat.local.toml")
log = logging.getLogger(__name__)
TURN_BUDGET_SECONDS = 48
REQUEST_TIMEOUT_SECONDS = 30
_turn_deadline = ContextVar("llm_turn_deadline", default=None)


@contextmanager
def turn_budget():
    """Each request gets an isolated budget shared by both LLM stages and retries."""
    token = _turn_deadline.set(monotonic() + TURN_BUDGET_SECONDS)
    try:
        yield
    finally:
        _turn_deadline.reset(token)


def compact_schema(value):
    if isinstance(value, dict):
        return {
            key: compact_schema(item)
            for key, item in value.items()
            if key not in {"title", "description", "default"}
        }
    if isinstance(value, list):
        return [compact_schema(item) for item in value]
    return value


def transient(error):
    if isinstance(error, HTTPError):
        return error.code in {408, 429, 500, 502, 503, 504}
    return isinstance(error, (TimeoutError, URLError, ConnectionError))


def request_json(request, deadline):
    """Retry once for transient failures, only within the original stage/turn budget."""
    for attempt in range(2):
        remaining = deadline - monotonic()
        if remaining <= 0:
            raise TimeoutError("LLM time budget exhausted")
        try:
            with urlopen(request, timeout=min(REQUEST_TIMEOUT_SECONDS, remaining)) as response:
                raw = response.read(256_001)
            if monotonic() >= deadline:
                raise TimeoutError("LLM time budget exhausted")
            return json.loads(raw)
        except (OSError, ValueError) as error:
            if attempt or not transient(error):
                if isinstance(error, HTTPError):
                    error.close()
                raise
            delay = 0.25
            if isinstance(error, HTTPError):
                try:
                    delay = max(delay, float(error.headers.get("Retry-After", "0")))
                except ValueError:
                    # A date-form/unknown Retry-After must not cause an immediate retry.
                    delay = 3
                except (AttributeError, TypeError):
                    pass
                finally:
                    error.close()
            # Do not retry earlier than Retry-After, or spend the last seconds on a retry.
            if delay > 2 or deadline - monotonic() < delay + 3:
                raise
            sleep(delay)


def failure_details(error, stage):
    """Return only bounded categories; never log provider bodies, prompts or credentials."""
    details = {"stage": stage, "reason": "invalid_response"}
    if isinstance(error, HTTPError):
        details.update(reason="provider_http_error", http_status=error.code)
    elif isinstance(error, TimeoutError) or (
        isinstance(error, URLError) and isinstance(error.reason, TimeoutError)
    ):
        details["reason"] = "timeout"
    elif isinstance(error, OSError):
        details["reason"] = "connection_error"
    elif isinstance(error, json.JSONDecodeError):
        details["reason"] = "invalid_json"
    log.warning(
        "LLM fallback stage=%s reason=%s http_status=%s",
        stage,
        details["reason"],
        details.get("http_status"),
    )
    return details


def settings():
    try:
        with CONFIG_PATH.open("rb") as source:
            local = tomllib.load(source)
    except (OSError, ValueError):
        local = {}
    return {
        name: os.getenv(env) or (local.get(name) if isinstance(local.get(name), str) else "")
        for name, env in {
            "api_key": "LLM_API_KEY",
            "model": "LLM_MODEL",
            "base_url": "LLM_BASE_URL",
        }.items()
    }


def provider():
    config = settings()
    if config["api_key"] and config["model"]:
        return "llm-api"
    if os.getenv("CHAT_OLLAMA_MODEL"):
        return "ollama"
    return None


def complete(messages, schema=None):
    engine = provider()
    if engine is None:
        raise ValueError("No LLM configured")
    headers = {"Content-Type": "application/json"}
    planning = "state" in (schema or {}).get("properties", {})
    max_tokens = 512 if planning else 1000
    # Leave at least 18 seconds for answering when understanding uses its full allowance.
    deadline = min(
        _turn_deadline.get() or monotonic() + TURN_BUDGET_SECONDS,
        monotonic() + REQUEST_TIMEOUT_SECONDS,
    )
    if engine == "ollama":
        endpoint = "http://127.0.0.1:11434/api/chat"
        payload = {
            "model": os.environ["CHAT_OLLAMA_MODEL"],
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": max_tokens},
        }
        if schema:
            payload["format"] = schema
    else:
        config = settings()
        base = (config["base_url"] or "https://api.opentyphoon.ai/v1").rstrip("/")
        url = urlsplit(base)
        if url.scheme != "https" or not url.hostname or url.username or url.password:
            raise ValueError("LLM_BASE_URL must be an HTTPS API base URL")
        endpoint = base + "/chat/completions"
        headers["Authorization"] = "Bearer " + config["api_key"]
        payload = {
            "model": config["model"],
            "messages": messages,
            "stream": False,
            "temperature": 0.2,
            "max_tokens": max_tokens,
        }
    request = Request(endpoint, data=json.dumps(payload).encode(), headers=headers)
    result = request_json(request, deadline)
    if engine == "ollama":
        content = result["message"]["content"]
    else:
        content = result["choices"][0]["message"]["content"]
    if not isinstance(content, str) or not content.strip() or len(content) > 12000:
        raise ValueError("Empty or oversized model reply")
    return content.strip()


def structured(messages, schema):
    content = complete(messages, schema)
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(content)


def conversation(history):
    # The request contract is larger for UI compatibility; model context is bounded.
    return [{"role": turn.role, "content": turn.content[:1000]} for turn in history[-6:]]
