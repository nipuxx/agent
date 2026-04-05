from __future__ import annotations

import json
import time
from pathlib import Path

STATE_PATH = Path.home() / ".local" / "share" / "nipux" / "state.json"

AGENT_CATALOG = [
    {
        "id": "browser",
        "label": "Browser agent",
        "description": "Web search, browsing, and extraction in an isolated agent session.",
        "mode": "Isolated session",
    },
    {
        "id": "code",
        "label": "Code agent",
        "description": "Repository work, patching, and file-heavy tasks through Hermes.",
        "mode": "Isolated session",
    },
    {
        "id": "terminal",
        "label": "Terminal agent",
        "description": "Command execution and environment bring-up with approvals.",
        "mode": "Isolated session",
    },
    {
        "id": "orchestrator",
        "label": "Orchestrator",
        "description": "A top-level agent that can route work across the other surfaces.",
        "mode": "Supervisor session",
    },
]


def _default_state(selected_model_id: str | None = None) -> dict:
    return {
        "runtime": {
            "status": "stopped",
            "model_loaded": False,
            "active_model_id": None,
            "recommended_model_id": selected_model_id,
            "endpoint": "http://127.0.0.1:8000/v1",
            "started_at": None,
        },
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "requests": 0,
        },
        "agents": [
            {
                **agent,
                "status": "stopped",
                "started_at": None,
            }
            for agent in AGENT_CATALOG
        ],
    }


def _ensure_parent() -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)


def load_state(selected_model_id: str | None = None) -> dict:
    state = _default_state(selected_model_id)
    if STATE_PATH.exists():
        try:
            raw = json.loads(STATE_PATH.read_text())
            if isinstance(raw, dict):
                state["runtime"].update(raw.get("runtime", {}))
                state["usage"].update(raw.get("usage", {}))
                raw_agents = {
                    item.get("id"): item
                    for item in raw.get("agents", [])
                    if isinstance(item, dict) and item.get("id")
                }
                state["agents"] = [
                    {
                        **agent,
                        **raw_agents.get(agent["id"], {}),
                    }
                    for agent in state["agents"]
                ]
        except Exception:
            pass

    if selected_model_id:
        state["runtime"]["recommended_model_id"] = selected_model_id

    return state


def save_state(state: dict) -> None:
    _ensure_parent()
    STATE_PATH.write_text(json.dumps(state, indent=2))


def build_runtime_state(state: dict, recommendation: dict) -> dict:
    runtime = dict(state["runtime"])
    if not runtime.get("active_model_id") and runtime.get("model_loaded"):
        runtime["active_model_id"] = recommendation.get("selected_model_id")
    return runtime


def build_usage_summary(
    state: dict,
    api_reference: dict | None,
    local_cost_per_million: float | None,
) -> dict:
    prompt_tokens = int(state["usage"].get("prompt_tokens", 0) or 0)
    completion_tokens = int(state["usage"].get("completion_tokens", 0) or 0)
    requests = int(state["usage"].get("requests", 0) or 0)
    api_cost = None
    if api_reference:
        api_cost = round(
            (prompt_tokens / 1_000_000.0) * float(api_reference["prompt_per_million_usd"])
            + (completion_tokens / 1_000_000.0) * float(api_reference["completion_per_million_usd"]),
            4,
        )
    total_tokens = prompt_tokens + completion_tokens
    local_cost = (
        round((total_tokens / 1_000_000.0) * float(local_cost_per_million), 4)
        if local_cost_per_million is not None
        else None
    )
    savings = (
        round(float(api_cost) - float(local_cost), 4)
        if api_cost is not None and local_cost is not None
        else None
    )
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "requests": requests,
        "api_equivalent_cost_usd": api_cost,
        "local_equivalent_cost_usd": local_cost,
        "savings_vs_api_usd": savings,
    }


def build_agents_summary(state: dict) -> list[dict]:
    now = time.time()
    agents = []
    for agent in state["agents"]:
        started_at = agent.get("started_at")
        uptime_seconds = int(max(0, now - float(started_at))) if started_at else 0
        agents.append({**agent, "uptime_seconds": uptime_seconds})
    return agents


def set_runtime_loaded(selected_model_id: str | None = None) -> dict:
    state = load_state(selected_model_id)
    runtime = state["runtime"]
    runtime["status"] = "running"
    runtime["model_loaded"] = True
    runtime["active_model_id"] = selected_model_id or runtime.get("recommended_model_id")
    runtime["started_at"] = int(time.time())
    save_state(state)
    return state


def set_runtime_unloaded(selected_model_id: str | None = None) -> dict:
    state = load_state(selected_model_id)
    runtime = state["runtime"]
    runtime["status"] = "stopped"
    runtime["model_loaded"] = False
    runtime["active_model_id"] = None
    runtime["started_at"] = None
    for agent in state["agents"]:
        agent["status"] = "stopped"
        agent["started_at"] = None
    save_state(state)
    return state


def set_agent_status(agent_id: str, running: bool, selected_model_id: str | None = None) -> dict:
    state = load_state(selected_model_id)
    runtime = state["runtime"]
    if running:
        runtime["status"] = "running"
        runtime["model_loaded"] = True
        runtime["active_model_id"] = runtime.get("active_model_id") or selected_model_id or runtime.get("recommended_model_id")
        runtime["started_at"] = runtime.get("started_at") or int(time.time())

    for agent in state["agents"]:
        if agent["id"] != agent_id:
            continue
        agent["status"] = "running" if running else "stopped"
        agent["started_at"] = int(time.time()) if running else None
        break

    save_state(state)
    return state
