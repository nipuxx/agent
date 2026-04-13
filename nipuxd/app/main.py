from __future__ import annotations

import re
from typing import Any

import psutil
from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .detection import detect_system
from .hermes_bridge import (
    get_hermes_log_lines,
    get_hermes_metrics,
    get_hermes_settings,
    get_hermes_status,
    save_hermes_settings,
)
from .pricing import get_openrouter_reference_for_size
from .schemas import SummaryResponse
from .state import (
    AGENT_CATALOG,
    build_agents_summary,
    build_runtime_state,
    load_state,
    set_agent_status,
    set_runtime_loaded,
    set_runtime_unloaded,
)

app = FastAPI(title="Nipux Daemon", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def infer_model_size(model_name: str | None) -> str | None:
    if not model_name:
        return None
    match = re.search(r"(?i)\b(9b|27b)\b", model_name)
    if match:
        return match.group(1).upper()
    return None


def build_usage_summary(metrics: dict[str, Any], api_reference: dict[str, Any] | None) -> dict[str, Any]:
    prompt_tokens = int(metrics.get("prompt_tokens", 0) or 0)
    completion_tokens = int(metrics.get("completion_tokens", 0) or 0)
    api_cost = None
    if api_reference:
        api_cost = round(
            (prompt_tokens / 1_000_000.0) * float(api_reference["prompt_per_million_usd"])
            + (completion_tokens / 1_000_000.0) * float(api_reference["completion_per_million_usd"]),
            4,
        )

    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": int(metrics.get("total_tokens", 0) or 0),
        "requests": int(metrics.get("total_sessions", 0) or 0),
        "tool_calls": int(metrics.get("tool_calls", 0) or 0),
        "api_equivalent_cost_usd": api_cost,
        "savings_vs_api_usd": api_cost,
    }


def build_nodes(state: dict[str, Any], metrics: dict[str, Any], settings: dict[str, Any]) -> list[dict[str, Any]]:
    recent_sessions = list(metrics.get("recent_sessions", []))
    nodes = []
    agents = build_agents_summary(state)
    for index, agent in enumerate(agents):
        session = recent_sessions[index] if index < len(recent_sessions) else None
        running = agent["status"] == "running"
        total_tokens = int(session.get("total_tokens", 0)) if session else 0
        tokens_per_sec = float(session.get("tokens_per_sec", 0.0)) if session else 0.0
        latency_ms = float(session.get("latency_ms", 0.0)) if session else 0.0
        if running and not session:
            tokens_per_sec = 0.0
            latency_ms = 0.0

        nodes.append(
            {
                "id": agent["id"],
                "identifier": f"NODE_{index + 1:02d}",
                "label": agent["label"],
                "status": "active" if running else "idle",
                "mode": agent["mode"],
                "model": (session or {}).get("model") or settings.get("model") or "UNASSIGNED",
                "latency_ms": round(latency_ms, 1),
                "tokens_per_sec": round(tokens_per_sec, 1),
                "total_tokens": total_tokens,
                "uptime_seconds": agent["uptime_seconds"],
                "description": agent["description"],
                "trend": [
                    max(8, min(72, int(total_tokens / factor))) if total_tokens else base
                    for factor, base in ((1600, 14), (1200, 22), (900, 30), (1400, 20))
                ],
            }
        )
    return nodes


def build_telemetry(system: dict[str, Any], nodes: list[dict[str, Any]], usage: dict[str, Any], metrics: dict[str, Any]) -> dict[str, Any]:
    memory = psutil.virtual_memory()
    return {
        "cpu_percent": round(psutil.cpu_percent(interval=0.0), 1),
        "ram_used_gb": round(memory.used / (1024 ** 3), 1),
        "ram_total_gb": round(memory.total / (1024 ** 3), 1),
        "node_count": len(nodes),
        "active_nodes": sum(1 for node in nodes if node["status"] == "active"),
        "active_sessions": int(metrics.get("active_sessions", 0) or 0),
        "total_sessions": int(metrics.get("total_sessions", 0) or 0),
        "total_tokens": usage["total_tokens"],
        "total_throughput_tps": round(sum(float(node["tokens_per_sec"]) for node in nodes), 1),
    }


def build_summary() -> SummaryResponse:
    system = detect_system()
    hermes = get_hermes_status()
    settings = get_hermes_settings()
    selected_model_id = settings.get("model") or None
    state = load_state(selected_model_id)
    runtime_state = build_runtime_state(state, {"selected_model_id": selected_model_id})
    if settings.get("openai_base_url"):
        runtime_state["endpoint"] = settings["openai_base_url"]

    size = infer_model_size(runtime_state.get("active_model_id") or settings.get("model"))
    api_reference = get_openrouter_reference_for_size(size)
    metrics = get_hermes_metrics(limit=4)
    usage_summary = build_usage_summary(metrics, api_reference)
    nodes = build_nodes(state, metrics, settings)
    telemetry = build_telemetry(system, nodes, usage_summary, metrics)
    log_lines = get_hermes_log_lines(limit=12)

    return SummaryResponse(
        product="Nipux",
        system=system,
        telemetry=telemetry,
        hermes=hermes,
        settings=settings,
        runtime_state=runtime_state,
        nodes=nodes,
        log_lines=log_lines,
        usage_summary=usage_summary,
        api_reference=api_reference,
        agents=build_agents_summary(state),
    )


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "nipuxd"}


@app.get("/api/summary", response_model=SummaryResponse)
def summary() -> SummaryResponse:
    return build_summary()


@app.get("/api/hermes/settings")
def get_settings() -> dict[str, Any]:
    return get_hermes_settings()


@app.put("/api/hermes/settings")
def update_settings(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    return save_hermes_settings(payload)


@app.post("/api/runtime/load", response_model=SummaryResponse)
def load_runtime() -> SummaryResponse:
    selected_model_id = get_hermes_settings().get("model") or None
    set_runtime_loaded(selected_model_id)
    return build_summary()


@app.post("/api/runtime/unload", response_model=SummaryResponse)
def unload_runtime() -> SummaryResponse:
    selected_model_id = get_hermes_settings().get("model") or None
    set_runtime_unloaded(selected_model_id)
    return build_summary()


@app.post("/api/agents/{agent_id}/start", response_model=SummaryResponse)
def start_agent(agent_id: str) -> SummaryResponse:
    if agent_id not in {agent["id"] for agent in AGENT_CATALOG}:
        raise HTTPException(status_code=404, detail="Unknown agent")
    selected_model_id = get_hermes_settings().get("model") or None
    set_agent_status(agent_id, True, selected_model_id)
    return build_summary()


@app.post("/api/agents/{agent_id}/stop", response_model=SummaryResponse)
def stop_agent(agent_id: str) -> SummaryResponse:
    if agent_id not in {agent["id"] for agent in AGENT_CATALOG}:
        raise HTTPException(status_code=404, detail="Unknown agent")
    selected_model_id = get_hermes_settings().get("model") or None
    set_agent_status(agent_id, False, selected_model_id)
    return build_summary()
