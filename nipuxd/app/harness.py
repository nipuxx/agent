from __future__ import annotations

import subprocess
import threading
import time
from pathlib import Path
from typing import Any

from .browser_service import browser_command, ensure_browser_session
from .db import (
    NIPUX_HOME,
    add_message,
    close_session,
    create_artifact,
    create_checkpoint,
    create_run,
    create_session,
    create_task_node,
    get_active_run_for_thread,
    get_active_session_for_agent,
    get_agent,
    get_app_settings,
    get_browser_session_by_agent,
    get_latest_checkpoint,
    get_run,
    get_runtime_state,
    get_session,
    get_task_node,
    get_thread,
    list_artifacts,
    list_child_task_nodes,
    list_messages,
    list_runs,
    list_task_nodes,
    make_id,
    update_agent,
    update_run,
    update_session,
    update_task_node,
)
from .event_bus import publish
from .model_client import chat_completion, parse_json_response
from .runtime_manager import get_runtime_status, start_runtime


_RUN_THREADS: dict[str, threading.Thread] = {}
_RUN_STOPS: dict[str, threading.Event] = {}
_LOCK = threading.RLock()


def _thread_title(body: str) -> str:
    cleaned = " ".join(body.strip().split())
    return cleaned[:56] if cleaned else "New thread"


def _workspace_for(agent_id: str) -> Path:
    root = Path(get_app_settings()["workspace_root"])
    path = root / agent_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def _resolve_model_connection(agent: dict[str, Any]) -> tuple[str, str, str]:
    settings = get_app_settings()
    runtime = get_runtime_status()
    endpoint = ""
    api_key = str(settings.get("openai_api_key") or "")
    model = str(settings.get("openai_model") or "")

    if runtime.get("model_loaded") and runtime.get("endpoint"):
        endpoint = str(runtime["endpoint"])
        health = runtime.get("health") or runtime.get("last_health") or {}
        models = health.get("models") or []
        if isinstance(models, list) and models:
            first = models[0] or {}
            model = str(first.get("id") or model or runtime.get("active_model_id") or "")
        else:
            model = str(runtime.get("active_model_id") or model)
        api_key = api_key or "nipux-local"
    elif settings.get("openai_base_url") and settings.get("openai_model"):
        endpoint = str(settings["openai_base_url"])
        model = str(settings["openai_model"])

    if not endpoint or not model:
        policy = agent.get("runtime_policy") or {}
        model_policy = agent.get("model_policy") or {}
        if policy.get("mode") != "external":
            runtime = start_runtime(
                runtime_id=policy.get("runtime_id") if policy.get("mode") not in {None, "auto"} else None,
                model_id=model_policy.get("model_id") if model_policy.get("mode") not in {None, "auto"} else None,
            )
            endpoint = str(runtime.get("endpoint") or "")
            health = runtime.get("health") or runtime.get("last_health") or {}
            models = health.get("models") or []
            if isinstance(models, list) and models:
                model = str((models[0] or {}).get("id") or runtime.get("active_model_id") or "")
            else:
                model = str(runtime.get("active_model_id") or "")
            api_key = api_key or "nipux-local"

    if not endpoint or not model:
        raise RuntimeError("No active model endpoint is configured. Start a runtime or set an external OpenAI-compatible endpoint in Settings.")
    return endpoint, api_key, model


def _session_metrics_update(session_id: str, usage: dict[str, int], latency_ms: float, tool_increment: int = 0) -> None:
    session = get_session(session_id)
    if session is None:
        return
    total_prompt = int(session["prompt_tokens"]) + int(usage.get("prompt_tokens") or 0)
    total_completion = int(session["completion_tokens"]) + int(usage.get("completion_tokens") or 0)
    total_tokens = int(session["total_tokens"]) + int(usage.get("total_tokens") or 0)
    elapsed = max(time.time() - float(session["started_at"]), 0.001)
    update_session(
        session_id,
        prompt_tokens=total_prompt,
        completion_tokens=total_completion,
        total_tokens=total_tokens,
        latency_ms=latency_ms,
        tokens_per_sec=round(total_tokens / elapsed, 2),
        tool_calls=int(session["tool_calls"]) + tool_increment,
    )


def _task_context(run: dict[str, Any], task: dict[str, Any], thread_id: str, agent_id: str) -> dict[str, Any]:
    checkpoint = get_latest_checkpoint(run["id"])
    browser = get_browser_session_by_agent(agent_id)
    recent_messages = list_messages(thread_id)[-6:]
    recent_artifacts = list_artifacts(run["id"])[:6]
    return {
        "goal": run["goal"],
        "task": {"title": task["title"], "objective": task["objective"], "attempt_count": task["attempt_count"]},
        "checkpoint": checkpoint,
        "browser": browser,
        "recent_messages": [
            {"role": item["role"], "label": item["label"], "body": item["body"][:1200]} for item in recent_messages
        ],
        "recent_artifacts": [
            {"kind": item["kind"], "label": item["label"], "path": item["path"], "content": item["content"]}
            for item in recent_artifacts
        ],
    }


def _planner_messages(run: dict[str, Any], agent: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You are the Nipux supervisor for a long-running local agent harness. "
                "Decompose the goal into 2-5 concrete subtasks with verification intent. "
                "Return JSON only: {\"subtasks\":[{\"title\":\"...\",\"objective\":\"...\",\"success_criteria\":\"...\"}]}"
            ),
        },
        {
            "role": "user",
            "content": f"Goal:\n{run['goal']}\n\nAgent profile:\n{agent['system_prompt']}",
        },
    ]


def _worker_messages(agent: dict[str, Any], context: dict[str, Any], tools: list[str]) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You are a Nipux worker inside a bounded long-running agent harness. "
                "Return strict JSON only. Prefer one concrete next step. "
                "Available action types: browser.navigate, browser.snapshot, browser.click, browser.type, browser.press, browser.scroll, browser.back, "
                "terminal.exec, files.read, files.write, finish, checkpoint. "
                "Schema: {\"thought\":\"short\",\"assistant_message\":\"optional\",\"action\":{\"type\":\"...\",\"args\":{}},\"verification\":\"what should be true\"}. "
                "Use finish only when the task objective is satisfied with evidence. Use checkpoint to summarize progress when useful."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Agent prompt:\n{agent['system_prompt']}\n\n"
                f"Available tools: {', '.join(tools)}\n\n"
                f"Context:\n{context}"
            ),
        },
    ]


def _chat_json(
    *,
    endpoint: str,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    max_tokens: int,
    session_id: str,
    repair_hint: str,
    retries: int = 1,
) -> dict[str, Any]:
    current_messages = list(messages)
    last_error: Exception | None = None
    for _ in range(retries + 1):
        response = chat_completion(
            endpoint=endpoint,
            api_key=api_key,
            model=model,
            messages=current_messages,
            max_tokens=max_tokens,
        )
        _session_metrics_update(session_id, response["usage"], response["latency_ms"])
        try:
            return parse_json_response(response["content"])
        except Exception as exc:
            last_error = exc
            prior = str(response.get("content") or "").strip() or "(empty response)"
            current_messages = list(messages) + [
                {"role": "assistant", "content": prior[:4000]},
                {
                    "role": "user",
                    "content": (
                        f"{repair_hint}\n"
                        "Return only valid JSON. No markdown fences. No prose. No explanation."
                    ),
                },
            ]
    raise RuntimeError(str(last_error or "Model did not return valid JSON."))


def _final_response_messages(
    run: dict[str, Any],
    thread_id: str,
    checkpoint_summary: str,
    artifacts: list[dict[str, Any]],
) -> list[dict[str, str]]:
    recent_messages = list_messages(thread_id)[-8:]
    return [
        {
            "role": "system",
            "content": (
                "You are the Nipux final responder. Produce the final user-facing answer only. "
                "Do not mention the harness, planning, checkpoints, or internal tooling unless the user explicitly asked for them. "
                "If the goal asks for exact wording, follow it exactly. "
                "Prefer concrete output over explanation."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Original goal:\n{run['goal']}\n\n"
                f"Latest accepted checkpoint:\n{checkpoint_summary}\n\n"
                f"Recent artifacts:\n{artifacts[:6]}\n\n"
                f"Recent thread messages:\n"
                f"{[{'role': item['role'], 'label': item['label'], 'body': item['body'][:1000]} for item in recent_messages]}"
            ),
        },
    ]


def _terminal_exec(agent_id: str, command: str) -> dict[str, Any]:
    cwd = _workspace_for(agent_id)
    started = time.time()
    result = subprocess.run(
        ["/bin/bash", "-lc", command],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=45,
        check=False,
    )
    output = "\n".join(part for part in [result.stdout.strip(), result.stderr.strip()] if part).strip()
    return {
        "ok": result.returncode == 0,
        "command": command,
        "cwd": str(cwd),
        "returncode": result.returncode,
        "output": output[:12000],
        "duration_ms": (time.time() - started) * 1000.0,
    }


def _files_action(agent_id: str, action_type: str, args: dict[str, Any]) -> dict[str, Any]:
    workspace = _workspace_for(agent_id)
    relative = str(args.get("path") or "").strip()
    if not relative:
        raise RuntimeError("Missing file path.")
    target = (workspace / relative).resolve()
    if workspace not in target.parents and target != workspace:
        raise RuntimeError("File action escaped the agent workspace.")
    if action_type == "files.read":
        return {"path": str(target), "content": target.read_text()[:12000], "ok": True}
    if action_type == "files.write":
        target.parent.mkdir(parents=True, exist_ok=True)
        content = str(args.get("content") or "")
        target.write_text(content)
        return {"path": str(target), "bytes": len(content.encode("utf-8")), "ok": True}
    raise RuntimeError(f"Unsupported file action: {action_type}")


def _plan_run(run_id: str, session_id: str, agent: dict[str, Any]) -> None:
    run = get_run(run_id)
    if run is None:
        return
    endpoint, api_key, model = _resolve_model_connection(agent)
    try:
        data = _chat_json(
            endpoint=endpoint,
            api_key=api_key,
            model=model,
            messages=_planner_messages(run, agent),
            max_tokens=1200,
            session_id=session_id,
            repair_hint=(
                "Repair your previous planner output to the required schema: "
                "{\"subtasks\":[{\"title\":\"...\",\"objective\":\"...\",\"success_criteria\":\"...\"}]}"
            ),
            retries=1,
        )
        subtasks = data.get("subtasks") if isinstance(data.get("subtasks"), list) else []
    except Exception:
        subtasks = []

    root = get_task_node(run["top_task_id"]) if run.get("top_task_id") else None
    if not subtasks:
        fallback = create_task_node(
            run_id,
            title="Primary task",
            objective=run["goal"],
            kind="task",
            parent_id=root["id"] if root else None,
            verifier={"type": "deliverable"},
            assigned_agent_id=agent["id"],
        )
        publish("run", run_id, "run.planned", {"subtasks": 1, "fallback": True})
        if root:
            update_task_node(root["id"], status="in_progress")
        return

    for item in subtasks[:5]:
        if not isinstance(item, dict):
            continue
        create_task_node(
            run_id,
            title=str(item.get("title") or "Subtask").strip()[:80],
            objective=str(item.get("objective") or "").strip() or str(item.get("title") or "Subtask"),
            kind="task",
            parent_id=root["id"] if root else None,
            verifier={"type": "criteria", "description": str(item.get("success_criteria") or "").strip()},
            assigned_agent_id=agent["id"],
        )
    if root:
        update_task_node(root["id"], status="in_progress")
    publish("run", run_id, "run.planned", {"subtasks": len(subtasks[:5]), "fallback": False})


def _complete_root_if_ready(run_id: str) -> bool:
    run = get_run(run_id)
    if run is None or not run.get("top_task_id"):
        return False
    children = list_child_task_nodes(run["top_task_id"])
    if not children:
        return False
    if all(child["status"] == "completed" for child in children):
        update_task_node(run["top_task_id"], status="completed")
        return True
    return False


def _execute_task(run_id: str, task_id: str, session_id: str, thread_id: str, agent: dict[str, Any], stop_event: threading.Event) -> bool:
    run = get_run(run_id)
    task = get_task_node(task_id)
    if run is None or task is None:
        return False

    settings = get_app_settings()
    tools = list(agent.get("toolsets") or [])
    action_budget = int(settings.get("worker_action_budget") or 8)
    checkpoint_every = max(1, int(settings.get("checkpoint_every_actions") or 3))
    browser_session = ensure_browser_session(agent["id"]) if "browser" in tools else None

    update_task_node(task_id, status="in_progress", attempt_count=task["attempt_count"] + 1)
    publish("task", task_id, "task.started", {"run_id": run_id, "title": task["title"]})

    last_observation = ""
    for index in range(action_budget):
        if stop_event.is_set():
            return False
        context = _task_context(run, get_task_node(task_id) or task, thread_id, agent["id"])
        if last_observation:
            context["last_observation"] = last_observation

        endpoint, api_key, model = _resolve_model_connection(agent)
        payload = _chat_json(
            endpoint=endpoint,
            api_key=api_key,
            model=model,
            messages=_worker_messages(agent, context, tools),
            max_tokens=1400,
            session_id=session_id,
            repair_hint=(
                "Repair your previous worker output to the required schema: "
                "{\"thought\":\"short\",\"assistant_message\":\"optional\",\"action\":{\"type\":\"...\",\"args\":{}},\"verification\":\"...\"}"
            ),
            retries=1,
        )
        assistant_message = str(payload.get("assistant_message") or "").strip()
        action = payload.get("action") if isinstance(payload.get("action"), dict) else {}
        action_type = str(action.get("type") or "checkpoint").strip()
        args = action.get("args") if isinstance(action.get("args"), dict) else {}
        verification = str(payload.get("verification") or "").strip()

        if assistant_message:
            message = add_message(thread_id, "assistant", "assistant", agent["name"], assistant_message, session_id=session_id)
            publish("thread", thread_id, "message.created", message)

        publish("task", task_id, "task.action.selected", {"action": action_type, "verification": verification})

        if action_type == "finish":
            summary = str(args.get("summary") or assistant_message or task["objective"]).strip()
            create_checkpoint(run_id, task_id=task_id, summary=summary, stats={"action_count": index + 1})
            update_task_node(task_id, status="completed")
            create_artifact(run_id, task_id=task_id, kind="result", label=task["title"], content={"summary": summary})
            publish("task", task_id, "task.completed", {"summary": summary})
            return True

        if action_type == "checkpoint":
            summary = str(args.get("summary") or assistant_message or "Checkpoint recorded.").strip()
            create_checkpoint(
                run_id,
                task_id=task_id,
                summary=summary,
                open_questions=args.get("open_questions") if isinstance(args.get("open_questions"), list) else [],
                stats={"action_count": index + 1},
            )
            publish("task", task_id, "task.checkpoint", {"summary": summary})
            last_observation = summary
            continue

        tool_result: dict[str, Any]
        if action_type.startswith("browser.") and browser_session:
            tool_result = browser_command(browser_session["id"], action_type.split(".", 1)[1], args)
        elif action_type == "terminal.exec" and "terminal" in tools:
            tool_result = _terminal_exec(agent["id"], str(args.get("command") or ""))
        elif action_type in {"files.read", "files.write"} and "file" in tools:
            tool_result = _files_action(agent["id"], action_type, args)
        else:
            raise RuntimeError(f"Unsupported or unavailable action `{action_type}`.")

        _session_metrics_update(session_id, {}, 0.0, tool_increment=1)
        observation = {
            "action": action_type,
            "result": tool_result,
            "verification": verification,
        }
        label = action_type.upper().replace(".", "_")
        message = add_message(thread_id, "tool", "tool", label, str(observation), session_id=session_id)
        publish("thread", thread_id, "message.created", message)
        create_artifact(run_id, task_id=task_id, kind="tool", label=label, content=observation, path=tool_result.get("frame_path"))
        publish("task", task_id, "tool.completed", {"action": action_type})
        last_observation = str(observation)[:5000]

        if (index + 1) % checkpoint_every == 0:
            create_checkpoint(
                run_id,
                task_id=task_id,
                summary=f"{task['title']}: accepted {index + 1} action(s).",
                stats={"action_count": index + 1},
            )
            publish("task", task_id, "task.checkpoint", {"summary": f"Accepted {index + 1} action(s)."})

    update_task_node(task_id, status="pending")
    publish("task", task_id, "task.yielded", {"reason": "action_budget_exhausted"})
    return False


def _finalize_run(run_id: str, thread_id: str, session_id: str) -> None:
    run = get_run(run_id)
    checkpoint = get_latest_checkpoint(run_id)
    summary = checkpoint["summary"] if checkpoint else "Run completed."
    final_text = summary
    if run is not None:
        agent = get_agent(run["agent_id"])
        if agent is not None:
            try:
                endpoint, api_key, model = _resolve_model_connection(agent)
                response = chat_completion(
                    endpoint=endpoint,
                    api_key=api_key,
                    model=model,
                    messages=_final_response_messages(run, thread_id, summary, list_artifacts(run_id)),
                    temperature=0.1,
                    max_tokens=700,
                )
                _session_metrics_update(session_id, response["usage"], response["latency_ms"])
                candidate = str(response["content"] or "").strip()
                if candidate:
                    final_text = candidate
            except Exception:
                pass
    add_message(thread_id, "assistant", "assistant", "Nipux", final_text, session_id=session_id)
    publish("thread", thread_id, "message.created", {"thread_id": thread_id, "label": "Nipux", "body": final_text[:500]})
    update_run(run_id, status="completed", ended_at=time.time())
    close_session(session_id, status="completed")
    publish("run", run_id, "run.completed", {"summary": final_text})


def _run_loop(run_id: str, session_id: str, thread_id: str, agent_id: str, stop_event: threading.Event) -> None:
    agent = get_agent(agent_id)
    if agent is None:
        return
    try:
        update_run(run_id, status="planning", started_at=time.time())
        _plan_run(run_id, session_id, agent)
        update_run(run_id, status="running")

        while not stop_event.is_set():
            if _complete_root_if_ready(run_id):
                break
            task = get_next_leaf_task(run_id)
            if task is None:
                break
            _execute_task(run_id, task["id"], session_id, thread_id, agent, stop_event)

        if stop_event.is_set():
            update_run(run_id, status="paused")
            close_session(session_id, status="stopped")
            publish("run", run_id, "run.paused", {"thread_id": thread_id})
            return

        _finalize_run(run_id, thread_id, session_id)
    except Exception as exc:
        update_run(run_id, status="error", ended_at=time.time(), last_error=str(exc))
        update_task_node(get_run(run_id)["top_task_id"], status="error") if get_run(run_id) and get_run(run_id)["top_task_id"] else None
        close_session(session_id, status="error", error=str(exc))
        publish("run", run_id, "run.error", {"error": str(exc)}, level="error")
        add_message(thread_id, "assistant", "assistant", "Nipux", f"Run failed: {exc}", session_id=session_id)
    finally:
        with _LOCK:
            _RUN_THREADS.pop(run_id, None)
            _RUN_STOPS.pop(run_id, None)


def get_next_leaf_task(run_id: str) -> dict[str, Any] | None:
    tasks = list_task_nodes(run_id)
    children: dict[str, list[dict[str, Any]]] = {}
    for task in tasks:
        if task["parent_id"]:
            children.setdefault(task["parent_id"], []).append(task)
    for task in tasks:
        if task["status"] not in {"pending", "in_progress"}:
            continue
        if children.get(task["id"]):
            continue
        return task
    return None


def ensure_run_for_message(thread_id: str, agent_id: str, body: str) -> tuple[dict[str, Any], dict[str, Any]]:
    run = get_active_run_for_thread(thread_id)
    if run is None:
        run = create_run(thread_id, agent_id, body)
        root = create_task_node(run["id"], title="Top level objective", objective=body, kind="root", assigned_agent_id=agent_id)
        run = update_run(run["id"], top_task_id=root["id"]) or run
    else:
        create_task_node(
            run["id"],
            parent_id=run.get("top_task_id"),
            title=_thread_title(body),
            objective=body,
            kind="followup",
            assigned_agent_id=agent_id,
        )

    active_session = get_active_session_for_agent(agent_id)
    if active_session is not None:
        return run, active_session

    session = create_session(
        thread_id,
        agent_id,
        transport="nipux",
        model=None,
        provider="nipux",
        endpoint=get_runtime_state().get("endpoint"),
    )
    return run, session


def dispatch_run(thread_id: str, agent_id: str) -> None:
    run = get_active_run_for_thread(thread_id)
    active_session = get_active_session_for_agent(agent_id)
    if run is None or active_session is None:
        return
    with _LOCK:
        if run["id"] in _RUN_THREADS and _RUN_THREADS[run["id"]].is_alive():
            return
        stop_event = threading.Event()
        worker = threading.Thread(
            target=_run_loop,
            args=(run["id"], active_session["id"], thread_id, agent_id, stop_event),
            daemon=True,
        )
        _RUN_THREADS[run["id"]] = worker
        _RUN_STOPS[run["id"]] = stop_event
        worker.start()


def stop_agent_runs(agent_id: str) -> None:
    for run in list(filter(lambda item: item["agent_id"] == agent_id and item["status"] in {"queued", "planning", "running", "paused"}, list_runs(limit=200))):
        with _LOCK:
            stop = _RUN_STOPS.get(run["id"])
            if stop:
                stop.set()


def pause_run(run_id: str) -> dict[str, Any] | None:
    with _LOCK:
        stop = _RUN_STOPS.get(run_id)
        if stop:
            stop.set()
    return update_run(run_id, status="paused")


def resume_run(run_id: str) -> dict[str, Any] | None:
    run = get_run(run_id)
    if run is None:
        return None
    update_run(run_id, status="running", last_error=None)
    dispatch_run(run["thread_id"], run["agent_id"])
    return get_run(run_id)


def cancel_run(run_id: str) -> dict[str, Any] | None:
    run = get_run(run_id)
    if run is None:
        return None
    with _LOCK:
        stop = _RUN_STOPS.get(run_id)
        if stop:
            stop.set()
    update_run(run_id, status="cancelled", ended_at=time.time())
    publish("run", run_id, "run.cancelled", {"thread_id": run["thread_id"]})
    return get_run(run_id)


def start_agent(agent_id: str) -> dict[str, Any]:
    agent = get_agent(agent_id)
    if agent is None:
        raise RuntimeError("Unknown agent.")
    ensure_browser_session(agent_id)
    update_agent(agent_id, {"status": "running"})
    publish("system", "agents", "agent.started", {"agent_id": agent_id})
    return get_agent(agent_id) or agent


def stop_agent(agent_id: str) -> dict[str, Any] | None:
    stop_agent_runs(agent_id)
    active_session = get_active_session_for_agent(agent_id)
    if active_session:
        close_session(active_session["id"], status="stopped")
    update_agent(agent_id, {"status": "stopped"})
    publish("system", "agents", "agent.stopped", {"agent_id": agent_id})
    return get_agent(agent_id)
