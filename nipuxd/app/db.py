from __future__ import annotations

import json
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any


NIPUX_HOME = Path.home() / ".local" / "share" / "nipux"
DB_PATH = NIPUX_HOME / "nipux.db"
LEGACY_STATE_PATH = NIPUX_HOME / "state.json"

LEGACY_DEMO_AGENT_IDS = ("browser", "code", "terminal", "orchestrator")

DEFAULT_APP_SETTINGS = {
    "setup_completed": False,
    "provider_mode": "local",
    "openai_base_url": "",
    "openai_api_key": "",
    "openai_model": "",
    "preferred_runtime_id": "",
    "preferred_model_id": "",
    "custom_model_enabled": False,
    "custom_model_name": "",
    "custom_model_repo": "",
    "custom_model_filename": "",
    "custom_model_runtime": "llama.cpp",
    "custom_model_size_gb": 0.0,
    "worker_action_budget": 8,
    "checkpoint_every_actions": 3,
    "max_runtime_minutes": 120,
    "browser_headless": True,
    "browser_viewport": {"width": 1280, "height": 800},
    "workspace_root": str(NIPUX_HOME / "workspaces"),
    "allow_terminal": True,
    "allow_browser": True,
    "allow_file_tools": True,
}


def _json_dumps(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"), sort_keys=True)


def _json_loads(raw: str | None, default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def _connect() -> sqlite3.Connection:
    NIPUX_HOME.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    conn = _connect()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS metadata (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS runtime_state (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              runtime_id TEXT,
              status TEXT NOT NULL DEFAULT 'stopped',
              model_loaded INTEGER NOT NULL DEFAULT 0,
              active_model_id TEXT,
              recommended_model_id TEXT,
              endpoint TEXT,
              model_path TEXT,
              started_at REAL,
              install_task_id TEXT,
              pid INTEGER,
              last_health_json TEXT,
              last_error TEXT
            );

            CREATE TABLE IF NOT EXISTS install_tasks (
              id TEXT PRIMARY KEY,
              kind TEXT NOT NULL,
              runtime_id TEXT,
              status TEXT NOT NULL,
              plan_json TEXT NOT NULL,
              detail_json TEXT,
              created_at REAL NOT NULL,
              updated_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agents (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT NOT NULL,
              system_prompt TEXT NOT NULL,
              toolsets_json TEXT NOT NULL,
              model_policy_json TEXT NOT NULL,
              runtime_policy_json TEXT NOT NULL,
              hermes_overrides_json TEXT NOT NULL,
              created_at REAL NOT NULL,
              updated_at REAL NOT NULL,
              last_session_id TEXT,
              status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS threads (
              id TEXT PRIMARY KEY,
              agent_id TEXT NOT NULL,
              title TEXT NOT NULL,
              status TEXT NOT NULL,
              hermes_session_id TEXT,
              created_at REAL NOT NULL,
              updated_at REAL NOT NULL,
              FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS sessions (
              id TEXT PRIMARY KEY,
              thread_id TEXT NOT NULL,
              agent_id TEXT NOT NULL,
              hermes_session_id TEXT,
              transport TEXT NOT NULL,
              status TEXT NOT NULL,
              model TEXT,
              provider TEXT,
              endpoint TEXT,
              pid INTEGER,
              started_at REAL NOT NULL,
              ended_at REAL,
              prompt_tokens INTEGER NOT NULL DEFAULT 0,
              completion_tokens INTEGER NOT NULL DEFAULT 0,
              total_tokens INTEGER NOT NULL DEFAULT 0,
              tokens_per_sec REAL NOT NULL DEFAULT 0,
              latency_ms REAL NOT NULL DEFAULT 0,
              tool_calls INTEGER NOT NULL DEFAULT 0,
              last_error TEXT,
              FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE,
              FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY,
              thread_id TEXT NOT NULL,
              session_id TEXT,
              role TEXT NOT NULL,
              kind TEXT NOT NULL,
              label TEXT NOT NULL,
              body TEXT NOT NULL,
              created_at REAL NOT NULL,
              FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE,
              FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS chat_threads (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              status TEXT NOT NULL,
              last_error TEXT,
              created_at REAL NOT NULL,
              updated_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
              id TEXT PRIMARY KEY,
              thread_id TEXT NOT NULL,
              role TEXT NOT NULL,
              kind TEXT NOT NULL,
              label TEXT NOT NULL,
              body TEXT NOT NULL,
              prompt_tokens INTEGER NOT NULL DEFAULT 0,
              completion_tokens INTEGER NOT NULL DEFAULT 0,
              total_tokens INTEGER NOT NULL DEFAULT 0,
              latency_ms REAL NOT NULL DEFAULT 0,
              created_at REAL NOT NULL,
              FOREIGN KEY(thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              stream_type TEXT NOT NULL,
              stream_id TEXT NOT NULL,
              event_type TEXT NOT NULL,
              level TEXT NOT NULL,
              payload_json TEXT NOT NULL,
              created_at REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS runs (
              id TEXT PRIMARY KEY,
              thread_id TEXT NOT NULL,
              agent_id TEXT NOT NULL,
              goal TEXT NOT NULL,
              status TEXT NOT NULL,
              success_criteria_json TEXT NOT NULL,
              budget_json TEXT NOT NULL,
              top_task_id TEXT,
              current_checkpoint_id TEXT,
              report_json TEXT NOT NULL,
              started_at REAL,
              ended_at REAL,
              created_at REAL NOT NULL,
              updated_at REAL NOT NULL,
              last_error TEXT,
              FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE,
              FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS task_nodes (
              id TEXT PRIMARY KEY,
              run_id TEXT NOT NULL,
              parent_id TEXT,
              kind TEXT NOT NULL,
              title TEXT NOT NULL,
              objective TEXT NOT NULL,
              inputs_json TEXT NOT NULL,
              constraints_json TEXT NOT NULL,
              verifier_json TEXT NOT NULL,
              budget_json TEXT NOT NULL,
              status TEXT NOT NULL,
              assigned_agent_id TEXT,
              attempt_count INTEGER NOT NULL DEFAULT 0,
              created_at REAL NOT NULL,
              updated_at REAL NOT NULL,
              FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE,
              FOREIGN KEY(parent_id) REFERENCES task_nodes(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS checkpoints (
              id TEXT PRIMARY KEY,
              run_id TEXT NOT NULL,
              task_id TEXT,
              summary TEXT NOT NULL,
              invariants_json TEXT NOT NULL,
              open_questions_json TEXT NOT NULL,
              stats_json TEXT NOT NULL,
              created_at REAL NOT NULL,
              FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE,
              FOREIGN KEY(task_id) REFERENCES task_nodes(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS artifacts (
              id TEXT PRIMARY KEY,
              run_id TEXT NOT NULL,
              task_id TEXT,
              kind TEXT NOT NULL,
              label TEXT NOT NULL,
              path TEXT,
              content_json TEXT NOT NULL,
              created_at REAL NOT NULL,
              FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE,
              FOREIGN KEY(task_id) REFERENCES task_nodes(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS browser_sessions (
              id TEXT PRIMARY KEY,
              agent_id TEXT NOT NULL UNIQUE,
              status TEXT NOT NULL,
              control_mode TEXT NOT NULL DEFAULT 'auto',
              current_url TEXT,
              title TEXT,
              last_frame_path TEXT,
              created_at REAL NOT NULL,
              updated_at REAL NOT NULL,
              FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_threads_agent_updated
              ON threads(agent_id, updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_messages_thread_created
              ON messages(thread_id, created_at ASC);
            CREATE INDEX IF NOT EXISTS idx_chat_threads_updated
              ON chat_threads(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created
              ON chat_messages(thread_id, created_at ASC);
            CREATE INDEX IF NOT EXISTS idx_sessions_agent_started
              ON sessions(agent_id, started_at DESC);
            CREATE INDEX IF NOT EXISTS idx_events_stream
              ON events(stream_type, stream_id, id ASC);
            CREATE INDEX IF NOT EXISTS idx_runs_thread_updated
              ON runs(thread_id, updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_task_nodes_run_status
              ON task_nodes(run_id, status, updated_at ASC);
            CREATE INDEX IF NOT EXISTS idx_checkpoints_run_created
              ON checkpoints(run_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_artifacts_run_created
              ON artifacts(run_id, created_at DESC);
            """
        )
        _bootstrap(conn)
        conn.commit()
    finally:
        conn.close()


def _bootstrap(conn: sqlite3.Connection) -> None:
    now = time.time()
    conn.execute(
        """
        INSERT OR IGNORE INTO metadata(key, value)
        VALUES ('schema_version', '1')
        """
    )
    conn.execute(
        """
        INSERT OR IGNORE INTO metadata(key, value)
        VALUES ('app_settings', ?)
        """,
        (_json_dumps(DEFAULT_APP_SETTINGS),),
    )
    conn.execute(
        """
        INSERT OR IGNORE INTO runtime_state(
          id, runtime_id, status, model_loaded, active_model_id, recommended_model_id,
          endpoint, model_path, started_at, install_task_id, pid, last_health_json, last_error
        )
        VALUES (1, NULL, 'stopped', 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
        """
    )

    _purge_legacy_demo_state(conn)

    imported = conn.execute(
        "SELECT value FROM metadata WHERE key = 'legacy_state_imported'"
    ).fetchone()
    if imported is None:
        _import_legacy_state(conn)
        conn.execute(
            "INSERT OR REPLACE INTO metadata(key, value) VALUES ('legacy_state_imported', '1')"
        )


def _purge_legacy_demo_state(conn: sqlite3.Connection) -> None:
    placeholders = ", ".join("?" for _ in LEGACY_DEMO_AGENT_IDS)
    conn.execute(f"DELETE FROM agents WHERE id IN ({placeholders})", LEGACY_DEMO_AGENT_IDS)

    cleaned = conn.execute(
        "SELECT value FROM metadata WHERE key = 'bootstrap_cleaned_v2'"
    ).fetchone()
    if cleaned is not None:
        return

    for table in (
        "browser_sessions",
        "artifacts",
        "checkpoints",
        "task_nodes",
        "runs",
        "chat_messages",
        "chat_threads",
        "messages",
        "sessions",
        "threads",
        "events",
        "agents",
    ):
        conn.execute(f"DELETE FROM {table}")
    conn.execute("DELETE FROM install_tasks")
    conn.execute(
        "INSERT OR REPLACE INTO metadata(key, value) VALUES ('bootstrap_cleaned_v2', '1')"
    )


def _import_legacy_state(conn: sqlite3.Connection) -> None:
    if not LEGACY_STATE_PATH.exists():
        return
    try:
        payload = json.loads(LEGACY_STATE_PATH.read_text())
    except json.JSONDecodeError:
        return
    if not isinstance(payload, dict):
        return

    runtime = payload.get("runtime") if isinstance(payload.get("runtime"), dict) else {}
    agents = payload.get("agents") if isinstance(payload.get("agents"), list) else []

    conn.execute(
        """
        UPDATE runtime_state
        SET status = ?, model_loaded = ?, active_model_id = ?, recommended_model_id = ?,
            endpoint = ?, started_at = ?
        WHERE id = 1
        """,
        (
            runtime.get("status", "stopped"),
            1 if runtime.get("model_loaded") else 0,
            runtime.get("active_model_id"),
            runtime.get("recommended_model_id"),
            runtime.get("endpoint"),
            runtime.get("started_at"),
        ),
    )

    for item in agents:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        conn.execute(
            """
            UPDATE agents
            SET status = ?, updated_at = ?, last_session_id = COALESCE(last_session_id, ?)
            WHERE id = ?
            """,
            (
                item.get("status", "stopped"),
                time.time(),
                None,
                item["id"],
            ),
        )


def connect() -> sqlite3.Connection:
    init_db()
    return _connect()


def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def get_runtime_state() -> dict[str, Any]:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM runtime_state WHERE id = 1").fetchone()
    finally:
        conn.close()
    if row is None:
        return {}
    return {
        "runtime_id": row["runtime_id"],
        "status": row["status"],
        "model_loaded": bool(row["model_loaded"]),
        "active_model_id": row["active_model_id"],
        "recommended_model_id": row["recommended_model_id"],
        "endpoint": row["endpoint"],
        "model_path": row["model_path"],
        "started_at": row["started_at"],
        "install_task_id": row["install_task_id"],
        "pid": row["pid"],
        "last_health": _json_loads(row["last_health_json"], {}),
        "last_error": row["last_error"],
    }


def update_runtime_state(**fields: Any) -> dict[str, Any]:
    if not fields:
        return get_runtime_state()
    allowed = {
        "runtime_id",
        "status",
        "model_loaded",
        "active_model_id",
        "recommended_model_id",
        "endpoint",
        "model_path",
        "started_at",
        "install_task_id",
        "pid",
        "last_health",
        "last_error",
    }
    sets: list[str] = []
    values: list[Any] = []
    for key, value in fields.items():
        if key not in allowed:
            continue
        column = "last_health_json" if key == "last_health" else key
        if key == "model_loaded":
            value = 1 if value else 0
        if key == "last_health":
            value = _json_dumps(value or {})
        sets.append(f"{column} = ?")
        values.append(value)
    if not sets:
        return get_runtime_state()

    conn = connect()
    try:
        conn.execute(f"UPDATE runtime_state SET {', '.join(sets)} WHERE id = 1", values)
        conn.commit()
    finally:
        conn.close()
    return get_runtime_state()


def get_metadata(key: str, default: Any = None) -> Any:
    conn = connect()
    try:
        row = conn.execute("SELECT value FROM metadata WHERE key = ?", (key,)).fetchone()
    finally:
        conn.close()
    if row is None:
        return default
    return _json_loads(row["value"], row["value"])


def set_metadata(key: str, value: Any) -> None:
    conn = connect()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)",
            (key, _json_dumps(value)),
        )
        conn.commit()
    finally:
        conn.close()


def list_agents() -> list[dict[str, Any]]:
    conn = connect()
    try:
        rows = conn.execute("SELECT * FROM agents ORDER BY created_at ASC").fetchall()
    finally:
        conn.close()
    return [_row_to_agent(row) for row in rows]


def get_agent(agent_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,)).fetchone()
    finally:
        conn.close()
    return _row_to_agent(row) if row else None


def create_agent(payload: dict[str, Any]) -> dict[str, Any]:
    now = time.time()
    agent_id = str(payload.get("id") or make_id("agent"))
    row = {
        "id": agent_id,
        "name": str(payload.get("name") or "New Agent").strip(),
        "description": str(payload.get("description") or "").strip(),
        "system_prompt": str(payload.get("system_prompt") or "").strip(),
        "toolsets": payload.get("toolsets") or ["browser", "terminal", "file", "clarify"],
        "model_policy": payload.get("model_policy") or {"mode": "auto"},
        "runtime_policy": payload.get("runtime_policy") or {"mode": "auto"},
        "hermes_overrides": payload.get("hermes_overrides") or {},
        "created_at": now,
        "updated_at": now,
        "last_session_id": None,
        "status": "stopped",
    }
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO agents(
              id, name, description, system_prompt, toolsets_json, model_policy_json,
              runtime_policy_json, hermes_overrides_json, created_at, updated_at,
              last_session_id, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                row["name"],
                row["description"],
                row["system_prompt"],
                _json_dumps(row["toolsets"]),
                _json_dumps(row["model_policy"]),
                _json_dumps(row["runtime_policy"]),
                _json_dumps(row["hermes_overrides"]),
                row["created_at"],
                row["updated_at"],
                row["last_session_id"],
                row["status"],
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return get_agent(agent_id) or row


def update_agent(agent_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {
        "name": "name",
        "description": "description",
        "system_prompt": "system_prompt",
        "toolsets": "toolsets_json",
        "model_policy": "model_policy_json",
        "runtime_policy": "runtime_policy_json",
        "hermes_overrides": "hermes_overrides_json",
        "last_session_id": "last_session_id",
        "status": "status",
    }
    sets: list[str] = ["updated_at = ?"]
    values: list[Any] = [time.time()]
    for key, column in allowed.items():
        if key not in payload:
            continue
        value = payload[key]
        if key in {"toolsets", "model_policy", "runtime_policy", "hermes_overrides"}:
            value = _json_dumps(value)
        sets.append(f"{column} = ?")
        values.append(value)
    values.append(agent_id)

    conn = connect()
    try:
        conn.execute(f"UPDATE agents SET {', '.join(sets)} WHERE id = ?", values)
        conn.commit()
    finally:
        conn.close()
    return get_agent(agent_id)


def delete_agent(agent_id: str) -> None:
    conn = connect()
    try:
        conn.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
        conn.commit()
    finally:
        conn.close()


def list_threads(agent_id: str | None = None) -> list[dict[str, Any]]:
    conn = connect()
    try:
        if agent_id:
            rows = conn.execute(
                "SELECT * FROM threads WHERE agent_id = ? ORDER BY updated_at DESC",
                (agent_id,),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM threads ORDER BY updated_at DESC").fetchall()
    finally:
        conn.close()
    return [_row_to_thread(row) for row in rows]


def get_thread(thread_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM threads WHERE id = ?", (thread_id,)).fetchone()
    finally:
        conn.close()
    return _row_to_thread(row) if row else None


def create_thread(agent_id: str, title: str) -> dict[str, Any]:
    thread_id = make_id("thread")
    now = time.time()
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO threads(id, agent_id, title, status, hermes_session_id, created_at, updated_at)
            VALUES (?, ?, ?, 'idle', NULL, ?, ?)
            """,
            (thread_id, agent_id, title, now, now),
        )
        conn.commit()
    finally:
        conn.close()
    return get_thread(thread_id) or {
        "id": thread_id,
        "agent_id": agent_id,
        "title": title,
        "status": "idle",
        "hermes_session_id": None,
        "created_at": now,
        "updated_at": now,
    }


def update_thread(thread_id: str, **fields: Any) -> dict[str, Any] | None:
    allowed = {"title", "status", "hermes_session_id"}
    sets = ["updated_at = ?"]
    values: list[Any] = [time.time()]
    for key, value in fields.items():
        if key not in allowed:
            continue
        sets.append(f"{key} = ?")
        values.append(value)
    values.append(thread_id)
    conn = connect()
    try:
        conn.execute(f"UPDATE threads SET {', '.join(sets)} WHERE id = ?", values)
        conn.commit()
    finally:
        conn.close()
    return get_thread(thread_id)


def list_messages(thread_id: str) -> list[dict[str, Any]]:
    conn = connect()
    try:
        rows = conn.execute(
            "SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC",
            (thread_id,),
        ).fetchall()
    finally:
        conn.close()
    return [_row_to_message(row) for row in rows]


def add_message(
    thread_id: str,
    role: str,
    kind: str,
    label: str,
    body: str,
    session_id: str | None = None,
) -> dict[str, Any]:
    message_id = make_id("msg")
    now = time.time()
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO messages(id, thread_id, session_id, role, kind, label, body, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (message_id, thread_id, session_id, role, kind, label, body, now),
        )
        conn.execute("UPDATE threads SET updated_at = ? WHERE id = ?", (now, thread_id))
        conn.commit()
    finally:
        conn.close()
    return {
        "id": message_id,
        "thread_id": thread_id,
        "session_id": session_id,
        "role": role,
        "kind": kind,
        "label": label,
        "body": body,
        "created_at": now,
    }


def list_chat_threads() -> list[dict[str, Any]]:
    conn = connect()
    try:
        rows = conn.execute("SELECT * FROM chat_threads ORDER BY updated_at DESC").fetchall()
    finally:
        conn.close()
    return [_row_to_chat_thread(row) for row in rows]


def get_chat_thread(thread_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM chat_threads WHERE id = ?", (thread_id,)).fetchone()
    finally:
        conn.close()
    return _row_to_chat_thread(row) if row else None


def create_chat_thread(title: str) -> dict[str, Any]:
    thread_id = make_id("chat")
    now = time.time()
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO chat_threads(id, title, status, last_error, created_at, updated_at)
            VALUES (?, ?, 'idle', NULL, ?, ?)
            """,
            (thread_id, title, now, now),
        )
        conn.commit()
    finally:
        conn.close()
    return get_chat_thread(thread_id) or {
        "id": thread_id,
        "title": title,
        "status": "idle",
        "last_error": None,
        "created_at": now,
        "updated_at": now,
    }


def update_chat_thread(thread_id: str, **fields: Any) -> dict[str, Any] | None:
    allowed = {"title", "status", "last_error"}
    sets = ["updated_at = ?"]
    values: list[Any] = [time.time()]
    for key, value in fields.items():
        if key not in allowed:
            continue
        sets.append(f"{key} = ?")
        values.append(value)
    values.append(thread_id)
    conn = connect()
    try:
        conn.execute(f"UPDATE chat_threads SET {', '.join(sets)} WHERE id = ?", values)
        conn.commit()
    finally:
        conn.close()
    return get_chat_thread(thread_id)


def list_chat_messages(thread_id: str) -> list[dict[str, Any]]:
    conn = connect()
    try:
        rows = conn.execute(
            "SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC",
            (thread_id,),
        ).fetchall()
    finally:
        conn.close()
    return [_row_to_chat_message(row) for row in rows]


def add_chat_message(
    thread_id: str,
    role: str,
    kind: str,
    label: str,
    body: str,
    *,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
    latency_ms: float = 0.0,
) -> dict[str, Any]:
    message_id = make_id("chatmsg")
    now = time.time()
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO chat_messages(
              id, thread_id, role, kind, label, body,
              prompt_tokens, completion_tokens, total_tokens, latency_ms, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                message_id,
                thread_id,
                role,
                kind,
                label,
                body,
                prompt_tokens,
                completion_tokens,
                total_tokens,
                latency_ms,
                now,
            ),
        )
        conn.execute("UPDATE chat_threads SET updated_at = ? WHERE id = ?", (now, thread_id))
        conn.commit()
    finally:
        conn.close()
    return {
        "id": message_id,
        "thread_id": thread_id,
        "role": role,
        "kind": kind,
        "label": label,
        "body": body,
        "prompt_tokens": int(prompt_tokens),
        "completion_tokens": int(completion_tokens),
        "total_tokens": int(total_tokens),
        "latency_ms": float(latency_ms),
        "created_at": now,
    }


def create_session(
    thread_id: str,
    agent_id: str,
    *,
    transport: str,
    model: str | None,
    provider: str | None,
    endpoint: str | None,
    pid: int | None = None,
    hermes_session_id: str | None = None,
) -> dict[str, Any]:
    session_id = make_id("session")
    now = time.time()
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO sessions(
              id, thread_id, agent_id, hermes_session_id, transport, status, model,
              provider, endpoint, pid, started_at
            )
            VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?)
            """,
            (session_id, thread_id, agent_id, hermes_session_id, transport, model, provider, endpoint, pid, now),
        )
        conn.execute(
            "UPDATE agents SET status = 'running', last_session_id = ?, updated_at = ? WHERE id = ?",
            (session_id, now, agent_id),
        )
        conn.execute(
            "UPDATE threads SET status = 'running', updated_at = ? WHERE id = ?",
            (now, thread_id),
        )
        conn.commit()
    finally:
        conn.close()
    return get_session(session_id) or {"id": session_id, "thread_id": thread_id, "agent_id": agent_id}


def get_session(session_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    finally:
        conn.close()
    return _row_to_session(row) if row else None


def get_active_session_for_agent(agent_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute(
            """
            SELECT * FROM sessions
            WHERE agent_id = ? AND status = 'running'
            ORDER BY started_at DESC
            LIMIT 1
            """,
            (agent_id,),
        ).fetchone()
    finally:
        conn.close()
    return _row_to_session(row) if row else None


def list_recent_sessions(limit: int = 20, agent_id: str | None = None) -> list[dict[str, Any]]:
    conn = connect()
    try:
        if agent_id:
            rows = conn.execute(
                """
                SELECT * FROM sessions
                WHERE agent_id = ?
                ORDER BY started_at DESC
                LIMIT ?
                """,
                (agent_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT * FROM sessions
                ORDER BY started_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
    finally:
        conn.close()
    return [_row_to_session(row) for row in rows]


def update_session(session_id: str, **fields: Any) -> dict[str, Any] | None:
    allowed = {
        "hermes_session_id",
        "status",
        "model",
        "provider",
        "endpoint",
        "pid",
        "ended_at",
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "tokens_per_sec",
        "latency_ms",
        "tool_calls",
        "last_error",
    }
    sets: list[str] = []
    values: list[Any] = []
    for key, value in fields.items():
        if key not in allowed:
            continue
        sets.append(f"{key} = ?")
        values.append(value)
    values.append(session_id)
    if not sets:
        return get_session(session_id)
    conn = connect()
    try:
        conn.execute(f"UPDATE sessions SET {', '.join(sets)} WHERE id = ?", values)
        conn.commit()
    finally:
        conn.close()
    return get_session(session_id)


def close_session(session_id: str, *, status: str, error: str | None = None) -> dict[str, Any] | None:
    session = get_session(session_id)
    if session is None:
        return None
    now = time.time()
    conn = connect()
    try:
        conn.execute(
            """
            UPDATE sessions
            SET status = ?, ended_at = COALESCE(ended_at, ?), last_error = COALESCE(?, last_error)
            WHERE id = ?
            """,
            (status, now, error, session_id),
        )
        conn.execute(
            """
            UPDATE threads
            SET status = ?, updated_at = ?
            WHERE id = ?
            """,
            ("error" if status == "error" else "idle", now, session["thread_id"]),
        )
        conn.execute(
            """
            UPDATE agents
            SET status = 'stopped', updated_at = ?
            WHERE id = ?
            """,
            (now, session["agent_id"]),
        )
        conn.commit()
    finally:
        conn.close()
    return get_session(session_id)


def create_install_task(kind: str, runtime_id: str | None, plan: dict[str, Any]) -> dict[str, Any]:
    task_id = make_id("task")
    now = time.time()
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO install_tasks(id, kind, runtime_id, status, plan_json, detail_json, created_at, updated_at)
            VALUES (?, ?, ?, 'queued', ?, ?, ?, ?)
            """,
            (task_id, kind, runtime_id, _json_dumps(plan), _json_dumps({"logs": []}), now, now),
        )
        conn.commit()
    finally:
        conn.close()
    return get_install_task(task_id) or {
        "id": task_id,
        "kind": kind,
        "runtime_id": runtime_id,
        "status": "queued",
        "plan": plan,
        "detail": {"logs": []},
        "created_at": now,
        "updated_at": now,
    }


def update_install_task(task_id: str, *, status: str | None = None, detail: dict[str, Any] | None = None) -> dict[str, Any] | None:
    task = get_install_task(task_id)
    if task is None:
        return None
    merged_detail = dict(task["detail"])
    if detail:
        if "logs" in detail and isinstance(detail["logs"], list):
            merged_detail.setdefault("logs", [])
            merged_detail["logs"].extend(detail["logs"])
        for key, value in detail.items():
            if key == "logs":
                continue
            merged_detail[key] = value
    conn = connect()
    try:
        conn.execute(
            """
            UPDATE install_tasks
            SET status = COALESCE(?, status), detail_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (status, _json_dumps(merged_detail), time.time(), task_id),
        )
        conn.commit()
    finally:
        conn.close()
    return get_install_task(task_id)


def get_install_task(task_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM install_tasks WHERE id = ?", (task_id,)).fetchone()
    finally:
        conn.close()
    if row is None:
        return None
    return {
        "id": row["id"],
        "kind": row["kind"],
        "runtime_id": row["runtime_id"],
        "status": row["status"],
        "plan": _json_loads(row["plan_json"], {}),
        "detail": _json_loads(row["detail_json"], {}),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def log_event(
    stream_type: str,
    stream_id: str,
    event_type: str,
    payload: dict[str, Any],
    *,
    level: str = "info",
) -> dict[str, Any]:
    created_at = time.time()
    conn = connect()
    try:
        cursor = conn.execute(
            """
            INSERT INTO events(stream_type, stream_id, event_type, level, payload_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (stream_type, stream_id, event_type, level, _json_dumps(payload), created_at),
        )
        event_id = cursor.lastrowid
        conn.commit()
    finally:
        conn.close()
    return {
        "id": event_id,
        "stream_type": stream_type,
        "stream_id": stream_id,
        "event_type": event_type,
        "level": level,
        "payload": payload,
        "created_at": created_at,
    }


def list_events(
    *,
    after_id: int = 0,
    stream_type: str | None = None,
    stream_id: str | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    query = "SELECT * FROM events WHERE id > ?"
    values: list[Any] = [after_id]
    if stream_type is not None:
        query += " AND stream_type = ?"
        values.append(stream_type)
    if stream_id is not None:
        query += " AND stream_id = ?"
        values.append(stream_id)
    query += " ORDER BY id ASC LIMIT ?"
    values.append(limit)
    conn = connect()
    try:
        rows = conn.execute(query, values).fetchall()
    finally:
        conn.close()
    return [_row_to_event(row) for row in rows]


def list_recent_events(limit: int = 50) -> list[dict[str, Any]]:
    conn = connect()
    try:
        rows = conn.execute(
            """
            SELECT * FROM events
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    finally:
        conn.close()
    events = [_row_to_event(row) for row in rows]
    events.reverse()
    return events


def get_usage_metrics() -> dict[str, Any]:
    conn = connect()
    try:
        session_row = conn.execute(
            """
            SELECT
              COUNT(*) AS total_sessions,
              COALESCE(SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END), 0) AS active_sessions,
              COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
              COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
              COALESCE(SUM(total_tokens), 0) AS total_tokens,
              COALESCE(SUM(tool_calls), 0) AS tool_calls,
              COALESCE(AVG(CASE WHEN status = 'running' THEN tokens_per_sec END), 0) AS avg_tps
            FROM sessions
            """
        ).fetchone()
        chat_row = conn.execute(
            """
            SELECT
              COUNT(*) AS chat_messages,
              COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
              COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
              COALESCE(SUM(total_tokens), 0) AS total_tokens
            FROM chat_messages
            """
        ).fetchone()
    finally:
        conn.close()
    return {
        "total_sessions": int(session_row["total_sessions"] or 0),
        "active_sessions": int(session_row["active_sessions"] or 0),
        "prompt_tokens": int(session_row["prompt_tokens"] or 0) + int(chat_row["prompt_tokens"] or 0),
        "completion_tokens": int(session_row["completion_tokens"] or 0) + int(chat_row["completion_tokens"] or 0),
        "total_tokens": int(session_row["total_tokens"] or 0) + int(chat_row["total_tokens"] or 0),
        "tool_calls": int(session_row["tool_calls"] or 0),
        "chat_messages": int(chat_row["chat_messages"] or 0),
        "avg_tps": float(session_row["avg_tps"] or 0.0),
    }


def get_app_settings() -> dict[str, Any]:
    raw = get_metadata("app_settings", DEFAULT_APP_SETTINGS)
    if not isinstance(raw, dict):
        return dict(DEFAULT_APP_SETTINGS)
    merged = dict(DEFAULT_APP_SETTINGS)
    merged.update(raw)
    return merged


def save_app_settings(payload: dict[str, Any]) -> dict[str, Any]:
    current = get_app_settings()
    current.update({key: value for key, value in payload.items() if value is not None})
    set_metadata("app_settings", current)
    return current


def get_browser_session_by_agent(agent_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM browser_sessions WHERE agent_id = ?", (agent_id,)).fetchone()
    finally:
        conn.close()
    return _row_to_browser_session(row) if row else None


def get_browser_session(session_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM browser_sessions WHERE id = ?", (session_id,)).fetchone()
    finally:
        conn.close()
    return _row_to_browser_session(row) if row else None


def create_or_replace_browser_session(agent_id: str) -> dict[str, Any]:
    existing = get_browser_session_by_agent(agent_id)
    if existing:
        return existing
    session_id = make_id("browser")
    now = time.time()
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO browser_sessions(id, agent_id, status, control_mode, current_url, title, last_frame_path, created_at, updated_at)
            VALUES (?, ?, 'idle', 'auto', '', '', NULL, ?, ?)
            """,
            (session_id, agent_id, now, now),
        )
        conn.commit()
    finally:
        conn.close()
    return get_browser_session(session_id) or {
        "id": session_id,
        "agent_id": agent_id,
        "status": "idle",
        "control_mode": "auto",
        "current_url": "",
        "title": "",
        "last_frame_path": None,
        "created_at": now,
        "updated_at": now,
    }


def update_browser_session(session_id: str, **fields: Any) -> dict[str, Any] | None:
    allowed = {"status", "control_mode", "current_url", "title", "last_frame_path"}
    sets = ["updated_at = ?"]
    values: list[Any] = [time.time()]
    for key, value in fields.items():
        if key not in allowed:
            continue
        sets.append(f"{key} = ?")
        values.append(value)
    values.append(session_id)
    conn = connect()
    try:
        conn.execute(f"UPDATE browser_sessions SET {', '.join(sets)} WHERE id = ?", values)
        conn.commit()
    finally:
        conn.close()
    return get_browser_session(session_id)


def list_runs(limit: int = 50, status: str | None = None) -> list[dict[str, Any]]:
    conn = connect()
    try:
        if status:
            rows = conn.execute(
                "SELECT * FROM runs WHERE status = ? ORDER BY updated_at DESC LIMIT ?",
                (status, limit),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM runs ORDER BY updated_at DESC LIMIT ?", (limit,)).fetchall()
    finally:
        conn.close()
    return [_row_to_run(row) for row in rows]


def get_run(run_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
    finally:
        conn.close()
    return _row_to_run(row) if row else None


def get_active_run_for_thread(thread_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute(
            """
            SELECT * FROM runs
            WHERE thread_id = ? AND status IN ('queued','planning','running','paused')
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (thread_id,),
        ).fetchone()
    finally:
        conn.close()
    return _row_to_run(row) if row else None


def create_run(
    thread_id: str,
    agent_id: str,
    goal: str,
    *,
    success_criteria: dict[str, Any] | None = None,
    budget: dict[str, Any] | None = None,
) -> dict[str, Any]:
    run_id = make_id("run")
    now = time.time()
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO runs(
              id, thread_id, agent_id, goal, status, success_criteria_json, budget_json,
              top_task_id, current_checkpoint_id, report_json, started_at, ended_at, created_at, updated_at, last_error
            )
            VALUES (?, ?, ?, ?, 'queued', ?, ?, NULL, NULL, ?, NULL, NULL, ?, ?, NULL)
            """,
            (
                run_id,
                thread_id,
                agent_id,
                goal,
                _json_dumps(success_criteria or {"type": "deliverable", "description": "Produce a verified answer or artifact."}),
                _json_dumps(budget or {}),
                _json_dumps({"summary": "", "artifacts": []}),
                now,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return get_run(run_id) or {"id": run_id, "thread_id": thread_id, "agent_id": agent_id, "goal": goal, "status": "queued"}


def update_run(run_id: str, **fields: Any) -> dict[str, Any] | None:
    allowed = {
        "status",
        "success_criteria",
        "budget",
        "top_task_id",
        "current_checkpoint_id",
        "report",
        "started_at",
        "ended_at",
        "last_error",
    }
    column_map = {
        "success_criteria": "success_criteria_json",
        "budget": "budget_json",
        "report": "report_json",
    }
    sets = ["updated_at = ?"]
    values: list[Any] = [time.time()]
    for key, value in fields.items():
        if key not in allowed:
            continue
        column = column_map.get(key, key)
        if key in {"success_criteria", "budget", "report"}:
            value = _json_dumps(value or {})
        sets.append(f"{column} = ?")
        values.append(value)
    values.append(run_id)
    conn = connect()
    try:
        conn.execute(f"UPDATE runs SET {', '.join(sets)} WHERE id = ?", values)
        conn.commit()
    finally:
        conn.close()
    return get_run(run_id)


def create_task_node(
    run_id: str,
    *,
    title: str,
    objective: str,
    kind: str = "task",
    parent_id: str | None = None,
    inputs: dict[str, Any] | None = None,
    constraints: dict[str, Any] | None = None,
    verifier: dict[str, Any] | None = None,
    budget: dict[str, Any] | None = None,
    assigned_agent_id: str | None = None,
) -> dict[str, Any]:
    task_id = make_id("task")
    now = time.time()
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO task_nodes(
              id, run_id, parent_id, kind, title, objective, inputs_json, constraints_json,
              verifier_json, budget_json, status, assigned_agent_id, attempt_count, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?)
            """,
            (
                task_id,
                run_id,
                parent_id,
                kind,
                title,
                objective,
                _json_dumps(inputs or {}),
                _json_dumps(constraints or {}),
                _json_dumps(verifier or {}),
                _json_dumps(budget or {}),
                assigned_agent_id,
                now,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return get_task_node(task_id) or {"id": task_id, "run_id": run_id, "title": title, "objective": objective, "status": "pending"}


def get_task_node(task_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM task_nodes WHERE id = ?", (task_id,)).fetchone()
    finally:
        conn.close()
    return _row_to_task_node(row) if row else None


def list_task_nodes(run_id: str) -> list[dict[str, Any]]:
    conn = connect()
    try:
        rows = conn.execute(
            "SELECT * FROM task_nodes WHERE run_id = ? ORDER BY created_at ASC",
            (run_id,),
        ).fetchall()
    finally:
        conn.close()
    return [_row_to_task_node(row) for row in rows]


def list_child_task_nodes(parent_id: str) -> list[dict[str, Any]]:
    conn = connect()
    try:
        rows = conn.execute(
            "SELECT * FROM task_nodes WHERE parent_id = ? ORDER BY created_at ASC",
            (parent_id,),
        ).fetchall()
    finally:
        conn.close()
    return [_row_to_task_node(row) for row in rows]


def update_task_node(task_id: str, **fields: Any) -> dict[str, Any] | None:
    allowed = {
        "title",
        "objective",
        "inputs",
        "constraints",
        "verifier",
        "budget",
        "status",
        "assigned_agent_id",
        "attempt_count",
    }
    column_map = {
        "inputs": "inputs_json",
        "constraints": "constraints_json",
        "verifier": "verifier_json",
        "budget": "budget_json",
    }
    sets = ["updated_at = ?"]
    values: list[Any] = [time.time()]
    for key, value in fields.items():
        if key not in allowed:
            continue
        column = column_map.get(key, key)
        if key in {"inputs", "constraints", "verifier", "budget"}:
            value = _json_dumps(value or {})
        sets.append(f"{column} = ?")
        values.append(value)
    values.append(task_id)
    conn = connect()
    try:
        conn.execute(f"UPDATE task_nodes SET {', '.join(sets)} WHERE id = ?", values)
        conn.commit()
    finally:
        conn.close()
    return get_task_node(task_id)


def get_next_pending_leaf_task(run_id: str) -> dict[str, Any] | None:
    tasks = list_task_nodes(run_id)
    children_by_parent: dict[str, list[dict[str, Any]]] = {}
    for task in tasks:
        if task["parent_id"]:
            children_by_parent.setdefault(task["parent_id"], []).append(task)
    for task in tasks:
        if task["status"] not in {"pending", "in_progress"}:
            continue
        if children_by_parent.get(task["id"]):
            continue
        return task
    return None


def create_checkpoint(
    run_id: str,
    *,
    summary: str,
    task_id: str | None = None,
    invariants: list[str] | None = None,
    open_questions: list[str] | None = None,
    stats: dict[str, Any] | None = None,
) -> dict[str, Any]:
    checkpoint_id = make_id("ckpt")
    now = time.time()
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO checkpoints(id, run_id, task_id, summary, invariants_json, open_questions_json, stats_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                checkpoint_id,
                run_id,
                task_id,
                summary,
                _json_dumps(invariants or []),
                _json_dumps(open_questions or []),
                _json_dumps(stats or {}),
                now,
            ),
        )
        conn.execute(
            "UPDATE runs SET current_checkpoint_id = ?, updated_at = ? WHERE id = ?",
            (checkpoint_id, now, run_id),
        )
        conn.commit()
    finally:
        conn.close()
    return get_checkpoint(checkpoint_id) or {"id": checkpoint_id, "run_id": run_id, "summary": summary}


def get_checkpoint(checkpoint_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM checkpoints WHERE id = ?", (checkpoint_id,)).fetchone()
    finally:
        conn.close()
    return _row_to_checkpoint(row) if row else None


def get_latest_checkpoint(run_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute(
            "SELECT * FROM checkpoints WHERE run_id = ? ORDER BY created_at DESC LIMIT 1",
            (run_id,),
        ).fetchone()
    finally:
        conn.close()
    return _row_to_checkpoint(row) if row else None


def create_artifact(
    run_id: str,
    *,
    kind: str,
    label: str,
    task_id: str | None = None,
    path: str | None = None,
    content: dict[str, Any] | None = None,
) -> dict[str, Any]:
    artifact_id = make_id("artifact")
    now = time.time()
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO artifacts(id, run_id, task_id, kind, label, path, content_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                artifact_id,
                run_id,
                task_id,
                kind,
                label,
                path,
                _json_dumps(content or {}),
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return get_artifact(artifact_id) or {"id": artifact_id, "run_id": run_id, "kind": kind, "label": label}


def get_artifact(artifact_id: str) -> dict[str, Any] | None:
    conn = connect()
    try:
        row = conn.execute("SELECT * FROM artifacts WHERE id = ?", (artifact_id,)).fetchone()
    finally:
        conn.close()
    return _row_to_artifact(row) if row else None


def list_artifacts(run_id: str) -> list[dict[str, Any]]:
    conn = connect()
    try:
        rows = conn.execute("SELECT * FROM artifacts WHERE run_id = ? ORDER BY created_at DESC", (run_id,)).fetchall()
    finally:
        conn.close()
    return [_row_to_artifact(row) for row in rows]


def _row_to_agent(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "label": row["name"],
        "description": row["description"],
        "system_prompt": row["system_prompt"],
        "toolsets": _json_loads(row["toolsets_json"], []),
        "model_policy": _json_loads(row["model_policy_json"], {}),
        "runtime_policy": _json_loads(row["runtime_policy_json"], {}),
        "hermes_overrides": _json_loads(row["hermes_overrides_json"], {}),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "last_session_id": row["last_session_id"],
        "status": row["status"],
    }


def _row_to_thread(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "agent_id": row["agent_id"],
        "title": row["title"],
        "status": row["status"],
        "hermes_session_id": row["hermes_session_id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _row_to_message(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "thread_id": row["thread_id"],
        "session_id": row["session_id"],
        "role": row["role"],
        "kind": row["kind"],
        "label": row["label"],
        "body": row["body"],
        "created_at": row["created_at"],
    }


def _row_to_chat_thread(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "status": row["status"],
        "last_error": row["last_error"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _row_to_chat_message(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "thread_id": row["thread_id"],
        "role": row["role"],
        "kind": row["kind"],
        "label": row["label"],
        "body": row["body"],
        "prompt_tokens": int(row["prompt_tokens"] or 0),
        "completion_tokens": int(row["completion_tokens"] or 0),
        "total_tokens": int(row["total_tokens"] or 0),
        "latency_ms": float(row["latency_ms"] or 0.0),
        "created_at": row["created_at"],
    }


def _row_to_session(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "thread_id": row["thread_id"],
        "agent_id": row["agent_id"],
        "hermes_session_id": row["hermes_session_id"],
        "transport": row["transport"],
        "status": row["status"],
        "model": row["model"],
        "provider": row["provider"],
        "endpoint": row["endpoint"],
        "pid": row["pid"],
        "started_at": row["started_at"],
        "ended_at": row["ended_at"],
        "prompt_tokens": int(row["prompt_tokens"] or 0),
        "completion_tokens": int(row["completion_tokens"] or 0),
        "total_tokens": int(row["total_tokens"] or 0),
        "tokens_per_sec": float(row["tokens_per_sec"] or 0.0),
        "latency_ms": float(row["latency_ms"] or 0.0),
        "tool_calls": int(row["tool_calls"] or 0),
        "last_error": row["last_error"],
    }


def _row_to_event(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "stream_type": row["stream_type"],
        "stream_id": row["stream_id"],
        "event_type": row["event_type"],
        "level": row["level"],
        "payload": _json_loads(row["payload_json"], {}),
        "created_at": row["created_at"],
    }


def _row_to_run(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "thread_id": row["thread_id"],
        "agent_id": row["agent_id"],
        "goal": row["goal"],
        "status": row["status"],
        "success_criteria": _json_loads(row["success_criteria_json"], {}),
        "budget": _json_loads(row["budget_json"], {}),
        "top_task_id": row["top_task_id"],
        "current_checkpoint_id": row["current_checkpoint_id"],
        "report": _json_loads(row["report_json"], {}),
        "started_at": row["started_at"],
        "ended_at": row["ended_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "last_error": row["last_error"],
    }


def _row_to_task_node(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "run_id": row["run_id"],
        "parent_id": row["parent_id"],
        "kind": row["kind"],
        "title": row["title"],
        "objective": row["objective"],
        "inputs": _json_loads(row["inputs_json"], {}),
        "constraints": _json_loads(row["constraints_json"], {}),
        "verifier": _json_loads(row["verifier_json"], {}),
        "budget": _json_loads(row["budget_json"], {}),
        "status": row["status"],
        "assigned_agent_id": row["assigned_agent_id"],
        "attempt_count": int(row["attempt_count"] or 0),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _row_to_checkpoint(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "run_id": row["run_id"],
        "task_id": row["task_id"],
        "summary": row["summary"],
        "invariants": _json_loads(row["invariants_json"], []),
        "open_questions": _json_loads(row["open_questions_json"], []),
        "stats": _json_loads(row["stats_json"], {}),
        "created_at": row["created_at"],
    }


def _row_to_artifact(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "run_id": row["run_id"],
        "task_id": row["task_id"],
        "kind": row["kind"],
        "label": row["label"],
        "path": row["path"],
        "content": _json_loads(row["content_json"], {}),
        "created_at": row["created_at"],
    }


def _row_to_browser_session(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "agent_id": row["agent_id"],
        "status": row["status"],
        "control_mode": row["control_mode"],
        "current_url": row["current_url"] or "",
        "title": row["title"] or "",
        "last_frame_path": row["last_frame_path"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
