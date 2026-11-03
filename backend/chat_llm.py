"""Bounded LLM transport. Credentials and endpoint configuration stay server-side."""

import json
import os
import tomllib
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

CONFIG_PATH = Path(__file__).with_name("chat.local.toml")


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
    if engine == "ollama":
        endpoint = "http://127.0.0.1:11434/api/chat"
        payload = {
            "model": os.environ["CHAT_OLLAMA_MODEL"],
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": 1400},
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
            "max_tokens": 1400,
        }
    request = Request(endpoint, data=json.dumps(payload).encode(), headers=headers)
    # Two calls per chat turn, bounded below the browser's 45-second timeout.
    with urlopen(request, timeout=18) as response:
        result = json.loads(response.read(256_001))
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
