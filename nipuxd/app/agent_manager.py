from __future__ import annotations

from typing import Any

from .db import (
    add_message,
    create_agent,
    create_thread,
    delete_agent,
    get_agent,
    get_browser_session_by_agent,
    get_thread,
    list_agents,
    list_messages,
    list_threads,
    update_agent,
    update_thread,
)
from .event_bus import publish
from .harness import dispatch_run, ensure_run_for_message, start_agent, stop_agent


def _thread_title(body: str) -> str:
    cleaned = " ".join(body.strip().split())
    return cleaned[:56] if cleaned else "New thread"


def list_agent_records() -> list[dict[str, Any]]:
    return list_agents()


def create_agent_record(payload: dict[str, Any]) -> dict[str, Any]:
    agent = create_agent(payload)
    publish("system", "agents", "agent.created", {"agent_id": agent["id"], "name": agent["name"]})
    return agent


def update_agent_record(agent_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    agent = update_agent(agent_id, payload)
    if agent:
        publish("system", "agents", "agent.updated", {"agent_id": agent_id})
    return agent


def delete_agent_record(agent_id: str) -> None:
    stop_agent(agent_id)
    delete_agent(agent_id)
    publish("system", "agents", "agent.deleted", {"agent_id": agent_id})


def list_thread_records(agent_id: str | None = None) -> list[dict[str, Any]]:
    return list_threads(agent_id)


def get_thread_bundle(thread_id: str) -> dict[str, Any] | None:
    thread = get_thread(thread_id)
    if thread is None:
        return None
    return {
        "thread": thread,
        "messages": list_messages(thread_id),
    }


def create_thread_record(agent_id: str, title: str | None = None) -> dict[str, Any]:
    agent = get_agent(agent_id)
    if agent is None:
        raise RuntimeError("Unknown agent.")
    thread = create_thread(agent_id, title or f"{agent['name']} thread")
    publish("thread", thread["id"], "thread.created", {"thread_id": thread["id"], "agent_id": agent_id})
    return thread


def post_thread_message(thread_id: str, body: str) -> dict[str, Any]:
    thread = get_thread(thread_id)
    if thread is None:
        raise RuntimeError("Unknown thread.")
    agent = get_agent(thread["agent_id"])
    if agent is None:
        raise RuntimeError("Unknown agent.")
    if not body.strip():
        raise RuntimeError("Message body cannot be empty.")

    if not thread["title"] or thread["title"].startswith("New "):
        update_thread(thread_id, title=_thread_title(body))

    if agent["status"] != "running":
        start_agent(agent["id"])

    message = add_message(thread_id, "user", "user", "user", body)
    publish("thread", thread_id, "message.created", message)

    run, session = ensure_run_for_message(thread_id, agent["id"], body)
    publish("run", run["id"], "run.queued", {"thread_id": thread_id, "session_id": session["id"]})
    dispatch_run(thread_id, agent["id"])
    return message


def get_agent_browser(agent_id: str) -> dict[str, Any] | None:
    return get_browser_session_by_agent(agent_id)
