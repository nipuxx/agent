from __future__ import annotations

import json
from typing import Any, Iterable

from .agent_manager import list_agent_records
from .db import (
    add_chat_message,
    create_chat_thread,
    get_app_settings,
    get_chat_thread,
    get_runtime_state,
    list_chat_messages,
    list_chat_threads,
    list_recent_events,
    list_runs,
    update_chat_thread,
)
from .detection import detect_system
from .event_bus import publish
from .model_client import chat_completion, stream_chat_completion
from .model_connection import resolve_model_connection


def _chat_title(body: str) -> str:
    cleaned = " ".join(body.strip().split())
    return cleaned[:56] if cleaned else "New chat"


def _sanitized_settings() -> dict[str, Any]:
    settings = get_app_settings()
    return {
        "provider_mode": settings.get("provider_mode"),
        "openai_model": settings.get("openai_model"),
        "preferred_runtime_id": settings.get("preferred_runtime_id"),
        "preferred_model_id": settings.get("preferred_model_id"),
        "workspace_root": settings.get("workspace_root"),
        "browser_headless": settings.get("browser_headless"),
        "allow_terminal": settings.get("allow_terminal"),
        "allow_browser": settings.get("allow_browser"),
        "allow_file_tools": settings.get("allow_file_tools"),
    }


def _system_context() -> dict[str, Any]:
    system = detect_system()
    runtime = get_runtime_state()
    return {
        "system": {
            "hostname": system.get("hostname"),
            "platform": system.get("platform"),
            "arch": system.get("arch"),
            "ram_gb": system.get("ram_gb"),
            "gpu_count": len(system.get("gpus", [])),
        },
        "runtime": {
            "status": runtime.get("status"),
            "runtime_id": runtime.get("runtime_id"),
            "model_loaded": runtime.get("model_loaded"),
            "active_model_id": runtime.get("active_model_id"),
            "endpoint": runtime.get("endpoint"),
            "last_error": runtime.get("last_error"),
        },
        "settings": _sanitized_settings(),
        "agents": [
            {
                "id": agent["id"],
                "name": agent["name"],
                "status": agent["status"],
                "description": agent["description"],
            }
            for agent in list_agent_records()
        ],
        "runs": [
            {
                "id": run["id"],
                "status": run["status"],
                "goal": run["goal"],
                "agent_id": run["agent_id"],
            }
            for run in list_runs(limit=8)
        ],
        "recent_events": [
            {
                "event_type": event["event_type"],
                "level": event["level"],
                "payload": event["payload"],
            }
            for event in list_recent_events(limit=10)
        ],
    }


def _chat_messages_for_model(thread_id: str) -> list[dict[str, str]]:
    history = list_chat_messages(thread_id)[-24:]
    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": (
                "You are the direct Nipux model chat. This is not the agent harness. "
                "Answer as a normal assistant, but use the provided Nipux system context when it is relevant. "
                "If the user asks what the system is doing, ground the answer in that context. "
                "Do not claim to have taken actions unless the context explicitly shows them.\n\n"
                "Nipux system context:\n"
                + json.dumps(_system_context(), ensure_ascii=True)
            ),
        },
    ]
    for item in history:
        if item["role"] not in {"user", "assistant", "system"}:
            continue
        messages.append({"role": item["role"], "content": item["body"]})
    return messages


def list_chat_thread_records() -> list[dict[str, Any]]:
    return list_chat_threads()


def get_chat_bundle(thread_id: str) -> dict[str, Any] | None:
    thread = get_chat_thread(thread_id)
    if thread is None:
        return None
    return {
        "thread": thread,
        "messages": list_chat_messages(thread_id),
    }


def create_chat_thread_record(title: str | None = None) -> dict[str, Any]:
    thread = create_chat_thread(title or "New chat")
    publish("chat", thread["id"], "chat.created", {"thread_id": thread["id"]})
    return thread


def post_chat_message(thread_id: str, body: str) -> dict[str, Any]:
    thread = get_chat_thread(thread_id)
    if thread is None:
        raise RuntimeError("Unknown chat.")
    if not body.strip():
        raise RuntimeError("Message body cannot be empty.")

    if not thread["title"] or thread["title"].startswith("New "):
        update_chat_thread(thread_id, title=_chat_title(body))

    update_chat_thread(thread_id, status="running", last_error=None)
    user_message = add_chat_message(thread_id, "user", "user", "user", body)
    publish("chat", thread_id, "message.created", user_message)

    try:
        endpoint, api_key, model = resolve_model_connection()
        response = chat_completion(
            endpoint=endpoint,
            api_key=api_key,
            model=model,
            messages=_chat_messages_for_model(thread_id),
            temperature=0.3,
            max_tokens=1400,
        )
    except Exception as exc:
        update_chat_thread(thread_id, status="error", last_error=str(exc))
        publish("chat", thread_id, "chat.failed", {"thread_id": thread_id, "error": str(exc)}, level="error")
        raise

    assistant_message = add_chat_message(
        thread_id,
        "assistant",
        "assistant",
        "assistant",
        response["content"],
        prompt_tokens=int(response["usage"]["prompt_tokens"]),
        completion_tokens=int(response["usage"]["completion_tokens"]),
        total_tokens=int(response["usage"]["total_tokens"]),
        latency_ms=float(response["latency_ms"]),
    )
    update_chat_thread(thread_id, status="idle", last_error=None)
    publish(
        "chat",
        thread_id,
        "message.created",
        {
            **assistant_message,
            "model": model,
        },
    )
    return assistant_message


def stream_chat_message(thread_id: str, body: str) -> Iterable[dict[str, Any]]:
    thread = get_chat_thread(thread_id)
    if thread is None:
        raise RuntimeError("Unknown chat.")
    if not body.strip():
        raise RuntimeError("Message body cannot be empty.")

    if not thread["title"] or thread["title"].startswith("New "):
        update_chat_thread(thread_id, title=_chat_title(body))

    update_chat_thread(thread_id, status="running", last_error=None)
    user_message = add_chat_message(thread_id, "user", "user", "user", body)
    publish("chat", thread_id, "message.created", user_message)
    yield {"type": "user", "message": user_message}

    try:
        endpoint, api_key, model = resolve_model_connection()
        content_parts: list[str] = []
        usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        latency_ms = 0.0
        for item in stream_chat_completion(
            endpoint=endpoint,
            api_key=api_key,
            model=model,
            messages=_chat_messages_for_model(thread_id),
            temperature=0.3,
            max_tokens=1400,
        ):
            if item["type"] == "delta":
                content_parts.append(str(item["content"]))
                yield {"type": "delta", "content": str(item["content"])}
            elif item["type"] == "usage":
                usage = dict(item["usage"])
                latency_ms = float(item["latency_ms"])
        assistant_body = "".join(content_parts).strip()
        assistant_message = add_chat_message(
            thread_id,
            "assistant",
            "assistant",
            "assistant",
            assistant_body,
            prompt_tokens=int(usage["prompt_tokens"]),
            completion_tokens=int(usage["completion_tokens"]),
            total_tokens=int(usage["total_tokens"]),
            latency_ms=latency_ms,
        )
        update_chat_thread(thread_id, status="idle", last_error=None)
        publish(
            "chat",
            thread_id,
            "message.created",
            {
                **assistant_message,
                "model": model,
            },
        )
        yield {"type": "done", "message": assistant_message}
    except Exception as exc:
        update_chat_thread(thread_id, status="error", last_error=str(exc))
        publish("chat", thread_id, "chat.failed", {"thread_id": thread_id, "error": str(exc)}, level="error")
        yield {"type": "error", "error": str(exc)}
