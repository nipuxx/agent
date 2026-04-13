from __future__ import annotations

import os
import shutil
import sqlite3
import subprocess
import time
from pathlib import Path
from typing import Any

import psutil
import yaml


HERMES_INSTALL_COMMAND = (
    "curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash"
)


def resolve_hermes_binary() -> str | None:
    explicit = os.getenv("NIPUX_HERMES_BINARY", "").strip()
    if explicit:
        return explicit
    return shutil.which("hermes")


def resolve_hermes_home(hermes_bin: str | None = None) -> Path:
    explicit = os.getenv("NIPUX_HERMES_HOME", "").strip()
    if explicit:
        return Path(explicit).expanduser()

    env_home = os.getenv("HERMES_HOME", "").strip()
    if env_home:
        return Path(env_home).expanduser()

    if hermes_bin:
        candidate_root = Path(hermes_bin).resolve().parents[2]
        candidate_home = candidate_root / ".hermes"
        if candidate_home.exists():
            return candidate_home

    return Path.home() / ".hermes"


def _run_command(args: list[str], timeout: int = 8) -> str:
    try:
        result = subprocess.run(
            args,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except Exception:
        return ""
    return (result.stdout or result.stderr).strip()


def _mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "•" * len(value)
    return f"{value[:4]}{'•' * max(4, len(value) - 8)}{value[-4:]}"


def _load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        data = yaml.safe_load(path.read_text())
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _save_yaml(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=False))


def _load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def _save_env(path: Path, values: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"{key}={value}" for key, value in values.items() if value is not None]
    path.write_text("\n".join(lines) + ("\n" if lines else ""))


def _set_nested(config: dict[str, Any], dotted_key: str, value: Any) -> None:
    parts = dotted_key.split(".")
    current = config
    for part in parts[:-1]:
        next_value = current.get(part)
        if not isinstance(next_value, dict):
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value


def _gateway_running(home: Path) -> bool:
    pid_path = home / "gateway.pid"
    if not pid_path.exists():
        return False
    try:
        pid = int(pid_path.read_text().strip())
    except Exception:
        return False
    return psutil.pid_exists(pid)


def get_hermes_status() -> dict[str, Any]:
    hermes_bin = resolve_hermes_binary()
    hermes_home = resolve_hermes_home(hermes_bin)
    config_path = hermes_home / "config.yaml"
    env_path = hermes_home / ".env"
    state_db_path = hermes_home / "state.db"
    logs_path = hermes_home / "logs" / "errors.log"

    version = None
    if hermes_bin:
        version = _run_command([hermes_bin, "--version"]) or None

    config = _load_yaml(config_path)
    env = _load_env(env_path)
    configured = bool(config.get("model")) or bool(env.get("OPENAI_BASE_URL")) or bool(env.get("OPENROUTER_API_KEY"))

    return {
        "installed": hermes_bin is not None,
        "configured": configured,
        "version": version,
        "binary": hermes_bin,
        "home": str(hermes_home),
        "config_path": str(config_path),
        "env_path": str(env_path),
        "state_db_path": str(state_db_path),
        "logs_path": str(logs_path),
        "gateway_running": _gateway_running(hermes_home),
        "install_command": HERMES_INSTALL_COMMAND,
    }


def get_hermes_settings() -> dict[str, Any]:
    status = get_hermes_status()
    config_path = Path(status["config_path"])
    env_path = Path(status["env_path"])
    config = _load_yaml(config_path)
    env = _load_env(env_path)

    return {
        "installed": status["installed"],
        "configured": status["configured"],
        "binary": status["binary"],
        "home": status["home"],
        "config_path": status["config_path"],
        "env_path": status["env_path"],
        "model": config.get("model", ""),
        "toolsets": config.get("toolsets", []),
        "max_turns": config.get("max_turns", 100),
        "terminal_backend": (config.get("terminal") or {}).get("backend", "local"),
        "terminal_cwd": (config.get("terminal") or {}).get("cwd", "."),
        "compression_enabled": (config.get("compression") or {}).get("enabled", True),
        "compression_threshold": (config.get("compression") or {}).get("threshold", 0.85),
        "display_personality": (config.get("display") or {}).get("personality", "kawaii"),
        "openai_base_url": env.get("OPENAI_BASE_URL", ""),
        "openrouter_api_key_set": bool(env.get("OPENROUTER_API_KEY")),
        "openrouter_api_key_hint": _mask_secret(env.get("OPENROUTER_API_KEY", "")),
        "openai_api_key_set": bool(env.get("OPENAI_API_KEY")),
        "openai_api_key_hint": _mask_secret(env.get("OPENAI_API_KEY", "")),
    }


def save_hermes_settings(payload: dict[str, Any]) -> dict[str, Any]:
    status = get_hermes_status()
    config_path = Path(status["config_path"])
    env_path = Path(status["env_path"])
    config = _load_yaml(config_path)
    env = _load_env(env_path)

    if "model" in payload:
        config["model"] = str(payload.get("model") or "")
    if "toolsets" in payload:
        toolsets = payload.get("toolsets") or []
        if isinstance(toolsets, str):
            toolsets = [part.strip() for part in toolsets.split(",") if part.strip()]
        config["toolsets"] = toolsets
    if "max_turns" in payload:
        config["max_turns"] = int(payload.get("max_turns") or 100)
    if "terminal_backend" in payload:
        _set_nested(config, "terminal.backend", str(payload.get("terminal_backend") or "local"))
    if "terminal_cwd" in payload:
        _set_nested(config, "terminal.cwd", str(payload.get("terminal_cwd") or "."))
    if "compression_enabled" in payload:
        _set_nested(config, "compression.enabled", bool(payload.get("compression_enabled")))
    if "compression_threshold" in payload:
        _set_nested(config, "compression.threshold", float(payload.get("compression_threshold") or 0.85))
    if "display_personality" in payload:
        _set_nested(config, "display.personality", str(payload.get("display_personality") or "kawaii"))

    if "openai_base_url" in payload:
        value = str(payload.get("openai_base_url") or "").strip()
        if value:
            env["OPENAI_BASE_URL"] = value
        else:
            env.pop("OPENAI_BASE_URL", None)
    if "openrouter_api_key" in payload:
        value = str(payload.get("openrouter_api_key") or "").strip()
        if value:
            env["OPENROUTER_API_KEY"] = value
    if "openai_api_key" in payload:
        value = str(payload.get("openai_api_key") or "").strip()
        if value:
            env["OPENAI_API_KEY"] = value

    _save_yaml(config_path, config)
    _save_env(env_path, env)
    return get_hermes_settings()


def get_hermes_metrics(limit: int = 4) -> dict[str, Any]:
    status = get_hermes_status()
    db_path = Path(status["state_db_path"])
    if not db_path.exists():
        return {
            "total_sessions": 0,
            "active_sessions": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "tool_calls": 0,
            "recent_sessions": [],
        }

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        overview = conn.execute(
            """
            SELECT
              COUNT(*) AS total_sessions,
              COALESCE(SUM(CASE WHEN ended_at IS NULL THEN 1 ELSE 0 END), 0) AS active_sessions,
              COALESCE(SUM(input_tokens), 0) AS prompt_tokens,
              COALESCE(SUM(output_tokens), 0) AS completion_tokens,
              COALESCE(SUM(tool_call_count), 0) AS tool_calls
            FROM sessions
            """
        ).fetchone()

        recent_rows = conn.execute(
            """
            SELECT id, source, model, started_at, ended_at, message_count, tool_call_count, input_tokens, output_tokens
            FROM sessions
            ORDER BY started_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    finally:
        conn.close()

    now = time.time()
    recent_sessions = []
    for row in recent_rows:
        started_at = float(row["started_at"] or now)
        ended_at = float(row["ended_at"]) if row["ended_at"] else None
        duration = max((ended_at or now) - started_at, 1.0)
        prompt_tokens = int(row["input_tokens"] or 0)
        completion_tokens = int(row["output_tokens"] or 0)
        total_tokens = prompt_tokens + completion_tokens
        message_count = int(row["message_count"] or 0)
        recent_sessions.append(
            {
                "id": row["id"],
                "source": row["source"],
                "model": row["model"] or "",
                "started_at": started_at,
                "ended_at": ended_at,
                "status": "active" if ended_at is None else "idle",
                "message_count": message_count,
                "tool_call_count": int(row["tool_call_count"] or 0),
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "tokens_per_sec": round(total_tokens / duration, 1) if total_tokens else 0.0,
                "latency_ms": round((duration / max(message_count, 1)) * 1000, 1) if message_count else 0.0,
            }
        )

    prompt_tokens = int(overview["prompt_tokens"] or 0)
    completion_tokens = int(overview["completion_tokens"] or 0)
    return {
        "total_sessions": int(overview["total_sessions"] or 0),
        "active_sessions": int(overview["active_sessions"] or 0),
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
        "tool_calls": int(overview["tool_calls"] or 0),
        "recent_sessions": recent_sessions,
    }


def get_hermes_log_lines(limit: int = 10) -> list[str]:
    status = get_hermes_status()
    log_path = Path(status["logs_path"])
    lines: list[str] = []
    if log_path.exists():
        try:
            file_lines = [line.rstrip() for line in log_path.read_text(errors="ignore").splitlines() if line.strip()]
            lines = file_lines[-limit:]
        except Exception:
            lines = []

    if lines:
        return lines

    metrics = get_hermes_metrics(limit=limit)
    synthesized = []
    for session in metrics["recent_sessions"]:
        synthesized.append(
            f"[{time.strftime('%H:%M:%S', time.localtime(session['started_at']))}] "
            f"SES: {session['id']} model={session['model'] or 'unknown'} "
            f"tokens={session['total_tokens']} tools={session['tool_call_count']}"
        )
    if synthesized:
        return synthesized[-limit:]

    return [
        "[--:--:--] SYS: Hermes not configured yet.",
        "[--:--:--] INF: Open Settings to connect Nipux to a Hermes install.",
    ]
