from __future__ import annotations

import queue
import threading
import time
from pathlib import Path
from typing import Any

from .db import (
    NIPUX_HOME,
    create_or_replace_browser_session,
    get_app_settings,
    get_browser_session,
    get_browser_session_by_agent,
    update_browser_session,
)
from .event_bus import publish


FRAMES_ROOT = NIPUX_HOME / "browser_frames"

_LOCK = threading.RLock()
_PLAYWRIGHT = None
_BROWSER = None
_RUNTIMES: dict[str, dict[str, Any]] = {}
_TASKS: queue.Queue[tuple[Any, threading.Event, dict[str, Any]]] = queue.Queue()
_WORKER: threading.Thread | None = None


def _require_playwright():
    global _PLAYWRIGHT, _BROWSER
    if _PLAYWRIGHT is not None and _BROWSER is not None:
        return _PLAYWRIGHT, _BROWSER

    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:  # pragma: no cover - dependency error path
        raise RuntimeError(
            "Playwright is not installed. Run `bash scripts/install.sh` to install browser support."
        ) from exc

    _PLAYWRIGHT = sync_playwright().start()
    settings = get_app_settings()
    headless = bool(settings.get("browser_headless", True))
    _BROWSER = _PLAYWRIGHT.chromium.launch(headless=headless)
    return _PLAYWRIGHT, _BROWSER


def _browser_worker() -> None:
    while True:
        fn, done, box = _TASKS.get()
        try:
            box["result"] = fn()
        except Exception as exc:  # pragma: no cover - cross-thread error transport
            box["error"] = exc
        finally:
            done.set()


def _ensure_worker() -> None:
    global _WORKER
    with _LOCK:
        if _WORKER is not None and _WORKER.is_alive():
            return
        _WORKER = threading.Thread(target=_browser_worker, name="nipux-browser", daemon=True)
        _WORKER.start()


def _call_browser(fn):
    _ensure_worker()
    done = threading.Event()
    box: dict[str, Any] = {}
    _TASKS.put((fn, done, box))
    done.wait()
    if "error" in box:
        raise box["error"]
    return box.get("result")


def _runtime_for(session_id: str) -> dict[str, Any]:
    if session_id in _RUNTIMES:
        return _RUNTIMES[session_id]

    _, browser = _require_playwright()
    settings = get_app_settings()
    viewport = settings.get("browser_viewport") or {"width": 1280, "height": 800}
    context = browser.new_context(viewport=viewport)
    page = context.new_page()
    runtime = {"context": context, "page": page}
    _RUNTIMES[session_id] = runtime
    return runtime


def _frame_path(session_id: str) -> Path:
    FRAMES_ROOT.mkdir(parents=True, exist_ok=True)
    return FRAMES_ROOT / f"{session_id}.jpg"


def _capture(page, session_id: str) -> dict[str, Any]:
    frame_path = _frame_path(session_id)
    page.screenshot(path=str(frame_path), type="jpeg", quality=85)
    title = page.title() if page.url else ""
    try:
        excerpt = page.locator("body").inner_text(timeout=2000)[:6000]
    except Exception:
        excerpt = ""
    update_browser_session(
        session_id,
        last_frame_path=str(frame_path),
        current_url=page.url,
        title=title,
        status="ready",
    )
    return {
        "frame_path": str(frame_path),
        "title": title,
        "url": page.url,
        "excerpt": excerpt,
        "captured_at": time.time(),
    }


def ensure_browser_session(agent_id: str) -> dict[str, Any]:
    record = get_browser_session_by_agent(agent_id) or create_or_replace_browser_session(agent_id)
    def _ensure() -> None:
        runtime = _runtime_for(record["id"])
        if runtime["page"].url:
            _capture(runtime["page"], record["id"])
        else:
            update_browser_session(record["id"], status="idle")

    _call_browser(_ensure)
    return get_browser_session(record["id"]) or record


def get_browser_view(agent_id: str) -> dict[str, Any]:
    session = ensure_browser_session(agent_id)
    return session


def get_frame_path(session_id: str) -> Path | None:
    session = get_browser_session(session_id)
    if not session or not session.get("last_frame_path"):
        return None
    path = Path(str(session["last_frame_path"]))
    return path if path.exists() else None


def browser_command(session_id: str, action: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = payload or {}
    session = get_browser_session(session_id)
    if session is None:
        raise RuntimeError("Unknown browser session.")
    if session["control_mode"] == "manual" and action not in {"resume", "snapshot"}:
        raise RuntimeError("Browser is in manual mode.")

    publish("browser", session_id, "browser.command.started", {"action": action, "payload": payload})

    def _run() -> dict[str, Any]:
        runtime = _runtime_for(session_id)
        page = runtime["page"]
        if action == "navigate":
            url = str(payload.get("url") or "").strip()
            if not url:
                raise RuntimeError("Missing browser URL.")
            if "://" not in url:
                url = f"https://duckduckgo.com/?q={url.replace(' ', '+')}"
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
        elif action == "click":
            selector = payload.get("selector")
            if selector:
                page.locator(str(selector)).first.click(timeout=8000)
            else:
                x = int(payload.get("x", 0))
                y = int(payload.get("y", 0))
                page.mouse.click(x, y)
        elif action == "type":
            selector = str(payload.get("selector") or "")
            text = str(payload.get("text") or "")
            if not selector:
                raise RuntimeError("Missing selector for browser type action.")
            page.locator(selector).first.fill(text, timeout=8000)
        elif action == "press":
            key = str(payload.get("key") or "")
            if not key:
                raise RuntimeError("Missing key for browser press action.")
            page.keyboard.press(key)
        elif action == "scroll":
            delta_y = int(payload.get("delta_y", 700))
            page.mouse.wheel(0, delta_y)
        elif action == "back":
            page.go_back(wait_until="domcontentloaded", timeout=15000)
        elif action == "pause":
            update_browser_session(session_id, control_mode="manual")
        elif action == "resume":
            update_browser_session(session_id, control_mode="auto")
        elif action != "snapshot":
            raise RuntimeError(f"Unsupported browser action: {action}")
        return _capture(page, session_id)

    try:
        snapshot = _call_browser(_run)
        publish("browser", session_id, "browser.command.completed", {"action": action, "url": snapshot["url"]})
        return {**(get_browser_session(session_id) or session), **snapshot}
    except Exception as exc:
        update_browser_session(session_id, status="error")
        publish(
            "browser",
            session_id,
            "browser.command.failed",
            {"action": action, "error": str(exc)},
            level="error",
        )
        raise


def close_browser_session(agent_id: str) -> None:
    session = get_browser_session_by_agent(agent_id)
    if not session:
        return
    def _close() -> None:
        runtime = _RUNTIMES.pop(session["id"], None)
        if runtime:
            try:
                runtime["context"].close()
            except Exception:
                pass

    _call_browser(_close)
    update_browser_session(session["id"], status="closed")
    publish("browser", session["id"], "browser.closed", {"agent_id": agent_id})
