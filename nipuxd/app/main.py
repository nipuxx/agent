from __future__ import annotations

from pathlib import Path
from typing import Any

import psutil
from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from .agent_manager import (
    create_agent_record,
    create_thread_record,
    delete_agent_record,
    get_agent_browser,
    get_thread_bundle,
    list_agent_records,
    list_thread_records,
    post_thread_message,
    update_agent_record,
)
from .chat_manager import (
    create_chat_thread_record,
    get_chat_bundle,
    list_chat_thread_records,
    post_chat_message,
)
from .browser_service import browser_command, get_browser_session, get_browser_view, get_frame_path
from .db import (
    get_active_run_for_thread,
    get_app_settings,
    get_run,
    get_runtime_state,
    get_usage_metrics,
    init_db,
    list_events,
    list_recent_events,
    list_runs,
    list_task_nodes,
    save_app_settings,
)
from .detection import detect_system
from .event_bus import stream_sse
from .harness import cancel_run, pause_run, resume_run, start_agent, stop_agent
from .runtime_manager import (
    get_runtime_plan,
    get_runtime_status,
    save_runtime_preferences,
    start_install_task,
    start_runtime,
    stop_runtime,
)


app = FastAPI(title="Nipux Daemon", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


def _recent_log_lines(limit: int = 12) -> list[str]:
    lines: list[str] = []
    for event in list_recent_events(limit=limit):
        payload = event.get("payload") or {}
        if isinstance(payload, dict):
            if payload.get("line"):
                lines.append(str(payload["line"]))
                continue
            if payload.get("message"):
                lines.append(str(payload["message"]))
                continue
            if event["event_type"].startswith("runtime."):
                lines.append(f"[runtime] {event['event_type']}")
                continue
            if event["event_type"].startswith("run."):
                lines.append(f"[run] {event['event_type']}")
                continue
            if event["event_type"].startswith("task."):
                lines.append(f"[task] {event['event_type']}")
                continue
            if event["event_type"].startswith("browser."):
                lines.append(f"[browser] {event['event_type']}")
                continue
        lines.append(event["event_type"])
    return lines[-limit:]


def _build_nodes(agents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    usage = get_usage_metrics()
    total_tokens = int(usage.get("total_tokens") or 0)
    avg_tps = float(usage.get("avg_tps") or 0.0)
    for index, agent in enumerate(agents):
        browser = get_agent_browser(agent["id"])
        active_run = None
        for run in list_runs(limit=20, status="running"):
            if run["agent_id"] == agent["id"]:
                active_run = run
                break
        nodes.append(
            {
                "id": agent["id"],
                "identifier": f"NODE_{index + 1:02d}",
                "label": agent["name"],
                "status": "active" if agent["status"] == "running" else "idle",
                "mode": "supervisor" if agent["id"] == "orchestrator" else "worker",
                "model": get_app_settings().get("openai_model") or get_runtime_state().get("active_model_id") or "UNBOUND",
                "latency_ms": 0.0,
                "tokens_per_sec": round(avg_tps if agent["status"] == "running" else 0.0, 1),
                "total_tokens": total_tokens,
                "uptime_seconds": 0,
                "description": active_run["goal"] if active_run else agent["description"],
                "trend": [18, 24, 30, 36] if agent["status"] == "running" else [10, 12, 14, 10],
                "browser_session_id": browser["id"] if browser else None,
                "browser_url": browser["current_url"] if browser else "",
            }
        )
    return nodes


def build_summary() -> dict[str, Any]:
    system = detect_system()
    runtime_state = get_runtime_status()
    runtime_plan = get_runtime_plan()
    settings = get_app_settings()
    agents = list_agent_records()
    runs = list_runs(limit=20)
    usage = get_usage_metrics()
    nodes = _build_nodes(agents)
    memory = psutil.virtual_memory()
    telemetry = {
        "cpu_percent": round(psutil.cpu_percent(interval=0.0), 1),
        "ram_used_gb": round(memory.used / (1024**3), 1),
        "ram_total_gb": round(memory.total / (1024**3), 1),
        "node_count": len(nodes),
        "active_nodes": sum(1 for item in nodes if item["status"] == "active"),
        "active_sessions": int(usage.get("active_sessions") or 0),
        "total_sessions": int(usage.get("total_sessions") or 0),
        "total_tokens": int(usage.get("total_tokens") or 0),
        "total_throughput_tps": round(sum(float(item["tokens_per_sec"]) for item in nodes), 1),
    }
    usage_summary = {
        "prompt_tokens": int(usage.get("prompt_tokens") or 0),
        "completion_tokens": int(usage.get("completion_tokens") or 0),
        "total_tokens": int(usage.get("total_tokens") or 0),
        "requests": int(usage.get("total_sessions") or 0),
        "tool_calls": int(usage.get("tool_calls") or 0),
        "api_equivalent_cost_usd": None,
        "savings_vs_api_usd": None,
    }
    return {
        "product": "Nipux",
        "system": system,
        "telemetry": telemetry,
        "settings": settings,
        "runtime_state": runtime_state,
        "runtime_plan": runtime_plan,
        "nodes": nodes,
        "log_lines": _recent_log_lines(),
        "usage_summary": usage_summary,
        "agents": agents,
        "runs": runs,
    }


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "nipuxd"}


@app.get("/api/summary")
def summary() -> dict[str, Any]:
    return build_summary()


@app.get("/api/events/stream")
def events_stream() -> StreamingResponse:
    return StreamingResponse(stream_sse(), media_type="text/event-stream")


@app.get("/api/runtime/plan")
def runtime_plan() -> dict[str, Any]:
    return get_runtime_plan()


@app.post("/api/runtime/install")
def runtime_install(payload: dict[str, Any] = Body(default={})) -> dict[str, Any]:
    runtime_id = payload.get("runtime_id")
    model_id = payload.get("model_id")
    if runtime_id or model_id:
        save_runtime_preferences(runtime_id=runtime_id, model_id=model_id)
    plan = get_runtime_plan()
    return start_install_task(plan)


@app.get("/api/runtime/install/{task_id}")
def runtime_install_task(task_id: str) -> dict[str, Any]:
    from .db import get_install_task

    task = get_install_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Unknown install task")
    return task


@app.post("/api/runtime/start")
def runtime_start(payload: dict[str, Any] = Body(default={})) -> dict[str, Any]:
    try:
        return start_runtime(runtime_id=payload.get("runtime_id"), model_id=payload.get("model_id"))
    except Exception as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/runtime/stop")
def runtime_stop() -> dict[str, Any]:
    return stop_runtime()


@app.get("/api/runtime/status")
def runtime_status() -> dict[str, Any]:
    return get_runtime_status()


@app.get("/api/settings")
def settings() -> dict[str, Any]:
    return get_app_settings()


@app.put("/api/settings")
def update_settings(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    settings = save_app_settings(payload)
    runtime_id = payload.get("preferred_runtime_id")
    model_id = payload.get("preferred_model_id")
    if runtime_id or model_id:
        save_runtime_preferences(runtime_id=runtime_id, model_id=model_id)
    return settings


@app.get("/api/agents")
def agents() -> list[dict[str, Any]]:
    return list_agent_records()


@app.post("/api/agents")
def agents_create(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    return create_agent_record(payload)


@app.patch("/api/agents/{agent_id}")
def agents_update(agent_id: str, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    agent = update_agent_record(agent_id, payload)
    if agent is None:
        raise HTTPException(status_code=404, detail="Unknown agent")
    return agent


@app.delete("/api/agents/{agent_id}")
def agents_delete(agent_id: str) -> dict[str, Any]:
    delete_agent_record(agent_id)
    return {"ok": True}


@app.post("/api/agents/{agent_id}/start")
def agents_start(agent_id: str) -> dict[str, Any]:
    try:
        result = start_agent(agent_id)
    except Exception as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return result


@app.post("/api/agents/{agent_id}/stop")
def agents_stop(agent_id: str) -> dict[str, Any]:
    agent = stop_agent(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Unknown agent")
    return agent


@app.get("/api/agents/{agent_id}/browser")
def agent_browser(agent_id: str) -> dict[str, Any]:
    session = get_browser_view(agent_id)
    return session


@app.get("/api/browser/{session_id}/frame")
def browser_frame(session_id: str) -> FileResponse:
    path = get_frame_path(session_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Browser frame not available")
    return FileResponse(path, media_type="image/jpeg")


@app.post("/api/browser/{session_id}/input")
def browser_input(session_id: str, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    action = str(payload.get("action") or "").strip()
    if not action:
        raise HTTPException(status_code=400, detail="Missing browser action")
    try:
        return browser_command(session_id, action, payload)
    except Exception as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/threads")
def threads(agent_id: str | None = Query(default=None)) -> list[dict[str, Any]]:
    return list_thread_records(agent_id)


@app.post("/api/threads")
def threads_create(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    agent_id = str(payload.get("agent_id") or "").strip()
    if not agent_id:
        raise HTTPException(status_code=400, detail="Missing agent_id")
    return create_thread_record(agent_id, payload.get("title"))


@app.get("/api/threads/{thread_id}")
def thread_bundle(thread_id: str) -> dict[str, Any]:
    bundle = get_thread_bundle(thread_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail="Unknown thread")
    return bundle


@app.post("/api/threads/{thread_id}/messages")
def thread_message(thread_id: str, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    body = str(payload.get("body") or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Missing message body")
    try:
        return post_thread_message(thread_id, body)
    except Exception as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/threads/{thread_id}/events")
def thread_events(thread_id: str) -> StreamingResponse:
    return StreamingResponse(stream_sse(stream_type="thread", stream_id=thread_id), media_type="text/event-stream")


@app.get("/api/chat/threads")
def chat_threads() -> list[dict[str, Any]]:
    return list_chat_thread_records()


@app.post("/api/chat/threads")
def chat_threads_create(payload: dict[str, Any] = Body(default={})) -> dict[str, Any]:
    return create_chat_thread_record(str(payload.get("title") or "").strip() or None)


@app.get("/api/chat/threads/{thread_id}")
def chat_thread_bundle(thread_id: str) -> dict[str, Any]:
    bundle = get_chat_bundle(thread_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail="Unknown chat")
    return bundle


@app.post("/api/chat/threads/{thread_id}/messages")
def chat_thread_message(thread_id: str, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    body = str(payload.get("body") or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="Missing message body")
    try:
        return post_chat_message(thread_id, body)
    except Exception as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/chat/threads/{thread_id}/events")
def chat_thread_events(thread_id: str) -> StreamingResponse:
    return StreamingResponse(stream_sse(stream_type="chat", stream_id=thread_id), media_type="text/event-stream")


@app.get("/api/runs")
def runs() -> list[dict[str, Any]]:
    return list_runs(limit=100)


@app.post("/api/runs")
def create_run_direct(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    thread_id = str(payload.get("thread_id") or "").strip()
    body = str(payload.get("goal") or "").strip()
    if not thread_id or not body:
        raise HTTPException(status_code=400, detail="Missing thread_id or goal")
    thread = get_thread_bundle(thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="Unknown thread")
    post_thread_message(thread_id, body)
    run = get_active_run_for_thread(thread_id)
    if run is None:
        raise HTTPException(status_code=409, detail="Failed to create run")
    return run


@app.get("/api/runs/{run_id}")
def run_detail(run_id: str) -> dict[str, Any]:
    run = get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Unknown run")
    tasks = list_task_nodes(run_id)
    return {**run, "tasks": tasks}


@app.post("/api/runs/{run_id}/pause")
def run_pause(run_id: str) -> dict[str, Any]:
    run = pause_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Unknown run")
    return run


@app.post("/api/runs/{run_id}/resume")
def run_resume(run_id: str) -> dict[str, Any]:
    run = resume_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Unknown run")
    return run


@app.post("/api/runs/{run_id}/cancel")
def run_cancel(run_id: str) -> dict[str, Any]:
    run = cancel_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Unknown run")
    return run


@app.get("/api/runs/{run_id}/tasks")
def run_tasks(run_id: str) -> list[dict[str, Any]]:
    if get_run(run_id) is None:
        raise HTTPException(status_code=404, detail="Unknown run")
    return list_task_nodes(run_id)


@app.get("/api/tasks/{task_id}")
def task_detail(task_id: str) -> dict[str, Any]:
    from .db import get_task_node

    task = get_task_node(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Unknown task")
    return task


@app.get("/api/runs/{run_id}/events")
def run_events(run_id: str) -> StreamingResponse:
    return StreamingResponse(stream_sse(stream_type="run", stream_id=run_id), media_type="text/event-stream")
