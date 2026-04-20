from __future__ import annotations

import os
import shutil
import signal
import subprocess
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .catalog import MODEL_CATALOG, RUNTIME_PROFILES
from .db import (
    NIPUX_HOME,
    create_install_task,
    get_install_task,
    get_metadata,
    get_runtime_state,
    set_metadata,
    update_install_task,
    update_runtime_state,
)
from .detection import detect_system
from .event_bus import publish
from .planner import build_install_plan, choose_model, choose_runtime, estimate_tokens_per_second


RUNTIME_ROOT = NIPUX_HOME / "runtimes"
MODELS_ROOT = NIPUX_HOME / "models"
DEFAULT_PORTS = {
    "mlx": 8014,
    "vllm": 8000,
    "llama.cpp": 8015,
}


class RuntimeAdapter:
    runtime_id = "base"
    label = "Runtime"

    def detect_capability(self, system: dict[str, Any]) -> dict[str, Any]:
        return {"supported": True, "reason": f"{self.label} is available for evaluation."}

    def install_commands(self, runtime_home: Path) -> list[list[str]]:
        return []

    def start_command(self, *, runtime_home: Path, model_path: Path, port: int) -> list[str]:
        raise NotImplementedError


class MlxAdapter(RuntimeAdapter):
    runtime_id = "mlx"
    label = "MLX"

    def detect_capability(self, system: dict[str, Any]) -> dict[str, Any]:
        return {
            "supported": bool(system.get("apple_silicon")),
            "reason": "Apple Silicon detected." if system.get("apple_silicon") else "MLX requires Apple Silicon.",
        }

    def install_commands(self, runtime_home: Path) -> list[list[str]]:
        python = runtime_home / "venv" / "bin" / "python"
        return [
            ["python3", "-m", "venv", str(runtime_home / "venv")],
            [str(python), "-m", "pip", "install", "--upgrade", "pip"],
            [str(python), "-m", "pip", "install", "mlx-lm", "huggingface_hub"],
        ]

    def start_command(self, *, runtime_home: Path, model_path: Path, port: int) -> list[str]:
        python = runtime_home / "venv" / "bin" / "python"
        return [
            str(python),
            "-m",
            "mlx_lm.server",
            "--model",
            str(model_path),
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ]


class VllmAdapter(RuntimeAdapter):
    runtime_id = "vllm"
    label = "vLLM"

    def detect_capability(self, system: dict[str, Any]) -> dict[str, Any]:
        vendors = {gpu.get("vendor") for gpu in system.get("gpus", [])}
        supported = "NVIDIA" in vendors
        return {
            "supported": supported,
            "reason": "CUDA-capable NVIDIA GPU detected." if supported else "vLLM requires a CUDA-capable NVIDIA host.",
        }

    def install_commands(self, runtime_home: Path) -> list[list[str]]:
        python = runtime_home / "venv" / "bin" / "python"
        return [
            ["python3", "-m", "venv", str(runtime_home / "venv")],
            [str(python), "-m", "pip", "install", "--upgrade", "pip"],
            [str(python), "-m", "pip", "install", "vllm", "huggingface_hub"],
        ]

    def start_command(self, *, runtime_home: Path, model_path: Path, port: int) -> list[str]:
        python = runtime_home / "venv" / "bin" / "python"
        return [
            str(python),
            "-m",
            "vllm.entrypoints.openai.api_server",
            "--model",
            str(model_path),
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ]


class LlamaCppAdapter(RuntimeAdapter):
    runtime_id = "llama.cpp"
    label = "llama.cpp"

    def install_commands(self, runtime_home: Path) -> list[list[str]]:
        python = runtime_home / "venv" / "bin" / "python"
        return [
            ["python3", "-m", "venv", str(runtime_home / "venv")],
            [str(python), "-m", "pip", "install", "--upgrade", "pip"],
            [str(python), "-m", "pip", "install", "llama-cpp-python[server]", "huggingface_hub"],
        ]

    def start_command(self, *, runtime_home: Path, model_path: Path, port: int) -> list[str]:
        server_bin = shutil.which("llama-server")
        if server_bin:
            return [
                server_bin,
                "--model",
                str(model_path),
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ]
        python = runtime_home / "venv" / "bin" / "python"
        return [
            str(python),
            "-m",
            "llama_cpp.server",
            "--model",
            str(model_path),
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ]


ADAPTERS: dict[str, RuntimeAdapter] = {
    "mlx": MlxAdapter(),
    "vllm": VllmAdapter(),
    "llama.cpp": LlamaCppAdapter(),
}


def _find_model(model_id: str | None) -> dict[str, Any] | None:
    if not model_id:
        return None
    return next((item for item in MODEL_CATALOG if item["id"] == model_id), None)


def _find_runtime(runtime_id: str | None) -> dict[str, Any] | None:
    if not runtime_id:
        return None
    return next((item for item in RUNTIME_PROFILES if item["id"] == runtime_id), None)


def _runtime_home(runtime_id: str) -> Path:
    return RUNTIME_ROOT / runtime_id


def _model_home(model_id: str) -> Path:
    return MODELS_ROOT / model_id


def _endpoint_for(runtime_id: str) -> str:
    return f"http://127.0.0.1:{DEFAULT_PORTS.get(runtime_id, 8000)}/v1"


def _health_url(endpoint: str) -> str:
    return endpoint.rstrip("/") + "/models"


def _request_json(url: str, timeout: int = 3) -> dict[str, Any] | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            payload = response.read().decode()
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None
    if not payload:
        return {}
    try:
        import json

        return json.loads(payload)
    except Exception:
        return {}


def get_runtime_plan() -> dict[str, Any]:
    system = detect_system()
    preferred_model_id = get_metadata("preferred_model_id")
    preferred_runtime_id = get_metadata("preferred_runtime_id")

    selected_model = _find_model(preferred_model_id)
    recommendation = choose_model(system)
    if selected_model is not None:
        recommendation = {
            "supported": True,
            "selected_model_id": selected_model["id"],
            "selected": selected_model,
            "effective_vram_gb": recommendation.get("effective_vram_gb"),
            "estimated_tokens_per_second": estimate_tokens_per_second(
                selected_model,
                float(recommendation.get("effective_vram_gb") or selected_model["min_vram_gb"]),
                max((gpu.get("memory_bandwidth_gbps") or 0.0) for gpu in system.get("gpus", [])) if system.get("gpus") else None,
            ),
            "estimated_cost_per_million_tokens_usd": recommendation.get("estimated_cost_per_million_tokens_usd"),
            "reason": f"Using saved Nipux model preference for {selected_model['family']} {selected_model['size']} {selected_model['quantization']}.",
            "platform_track": recommendation.get("platform_track"),
        }

    runtime = choose_runtime(system, selected_model or recommendation.get("selected"))
    if preferred_runtime_id:
        runtime_row = _find_runtime(preferred_runtime_id)
        if runtime_row:
            runtime = {
                "id": runtime_row["id"],
                "label": runtime_row["label"],
                "reason": f"Using saved Nipux runtime preference for {runtime_row['label']}.",
            }

    install_plan = build_install_plan(system, recommendation, runtime, None)
    adapter = ADAPTERS[runtime["id"]]
    capability = adapter.detect_capability(system)

    return {
        "system": system,
        "recommendation": recommendation,
        "runtime": runtime,
        "runtime_profile": _find_runtime(runtime["id"]),
        "model": recommendation.get("selected"),
        "runtime_options": RUNTIME_PROFILES,
        "model_options": MODEL_CATALOG,
        "install_plan": {
            **install_plan,
            "blocked": not recommendation.get("supported", False) or not capability.get("supported", False),
            "capability_reason": capability.get("reason"),
        },
    }


def _model_download_command(runtime_home: Path, model: dict[str, Any], target_dir: Path) -> list[str]:
    python = runtime_home / "venv" / "bin" / "python"
    script = (
        "from huggingface_hub import hf_hub_download, snapshot_download;"
        f"repo={model['repo']!r}.split('huggingface.co/')[-1];"
        f"target={str(target_dir)!r};"
        f"filename={model['filename']!r};"
        "import os;"
        "os.makedirs(target, exist_ok=True);"
        "if filename.startswith('mlx-'):"
        " snapshot_download(repo_id=repo, local_dir=target, local_dir_use_symlinks=False);"
        "else:"
        " path=hf_hub_download(repo_id=repo, filename=filename, local_dir=target, local_dir_use_symlinks=False);"
        " print(path)"
    )
    return [str(python), "-c", script]


def _run_install_task(task_id: str, runtime_id: str, runtime_home: Path, model: dict[str, Any] | None) -> None:
    adapter = ADAPTERS[runtime_id]
    update_install_task(task_id, status="running", detail={"logs": [f"Installing {runtime_id} runtime."]})
    publish("system", "runtime", "runtime.install.started", {"task_id": task_id, "runtime_id": runtime_id})
    runtime_home.mkdir(parents=True, exist_ok=True)

    try:
        for command in adapter.install_commands(runtime_home):
            update_install_task(task_id, detail={"logs": ["$ " + " ".join(command)]})
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            combined = "\n".join(part for part in [result.stdout.strip(), result.stderr.strip()] if part)
            if combined:
                update_install_task(task_id, detail={"logs": [combined]})
            if result.returncode != 0:
                raise RuntimeError(f"{' '.join(command)} failed with code {result.returncode}")
        if model is not None:
            model_dir = _model_home(model["id"])
            model_dir.mkdir(parents=True, exist_ok=True)
            command = _model_download_command(runtime_home, model, model_dir)
            update_install_task(task_id, detail={"logs": [f"Downloading {model['id']} from {model['repo']}."]})
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            combined = "\n".join(part for part in [result.stdout.strip(), result.stderr.strip()] if part)
            if combined:
                update_install_task(task_id, detail={"logs": [combined]})
            if result.returncode != 0:
                raise RuntimeError(f"Model download failed for {model['id']}")
        update_install_task(task_id, status="completed", detail={"logs": [f"{runtime_id} install complete."]})
        publish("system", "runtime", "runtime.install.completed", {"task_id": task_id, "runtime_id": runtime_id})
    except Exception as exc:
        update_install_task(task_id, status="failed", detail={"logs": [str(exc)]})
        publish("system", "runtime", "runtime.install.failed", {"task_id": task_id, "error": str(exc)}, level="error")


def start_install_task(plan: dict[str, Any]) -> dict[str, Any]:
    runtime_id = plan["runtime"]["id"]
    task = create_install_task("runtime_install", runtime_id, plan)
    update_runtime_state(install_task_id=task["id"])
    thread = threading.Thread(
        target=_run_install_task,
        args=(task["id"], runtime_id, _runtime_home(runtime_id), plan.get("model")),
        daemon=True,
    )
    thread.start()
    return get_install_task(task["id"]) or task


def get_runtime_status() -> dict[str, Any]:
    state = get_runtime_state()
    endpoint = state.get("endpoint")
    health = state.get("last_health") or {}
    if state.get("status") == "running" and not endpoint and not state.get("pid"):
        state = update_runtime_state(
            status="stopped",
            model_loaded=False,
            active_model_id=None,
            started_at=None,
            last_error=None,
        )
        health = {}
    if endpoint:
        remote = _request_json(_health_url(endpoint))
        if remote is not None:
            health = {
                "ok": True,
                "checked_at": time.time(),
                "models": remote.get("data") if isinstance(remote, dict) else None,
            }
            update_runtime_state(last_health=health)
        elif state.get("status") == "running":
            health = {
                "ok": False,
                "checked_at": time.time(),
                "error": "Runtime endpoint did not respond.",
            }
            if not state.get("pid"):
                state = update_runtime_state(
                    status="stopped",
                    model_loaded=False,
                    active_model_id=None,
                    last_health=health,
                    last_error=health["error"],
                )
            else:
                update_runtime_state(last_health=health)
    return {**state, "health": health}


def save_runtime_preferences(*, runtime_id: str | None = None, model_id: str | None = None) -> None:
    if runtime_id is not None:
        set_metadata("preferred_runtime_id", runtime_id)
        update_runtime_state(runtime_id=runtime_id)
    if model_id is not None:
        set_metadata("preferred_model_id", model_id)
        update_runtime_state(recommended_model_id=model_id)


def start_runtime(*, runtime_id: str | None = None, model_id: str | None = None) -> dict[str, Any]:
    plan = get_runtime_plan()
    runtime_id = runtime_id or plan["runtime"]["id"]
    model_id = model_id or plan["recommendation"].get("selected_model_id")
    model = _find_model(model_id)
    if model is None:
        raise RuntimeError("No compatible model selected for this host.")

    adapter = ADAPTERS[runtime_id]
    runtime_home = _runtime_home(runtime_id)
    model_home = _model_home(model["id"])
    runtime_home.mkdir(parents=True, exist_ok=True)
    model_home.mkdir(parents=True, exist_ok=True)

    endpoint = _endpoint_for(runtime_id)
    port = DEFAULT_PORTS.get(runtime_id, 8000)
    command = adapter.start_command(runtime_home=runtime_home, model_path=model_home, port=port)
    log_path = runtime_home / "runtime.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_handle = log_path.open("a")
    process = subprocess.Popen(
        command,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        cwd=str(runtime_home),
        start_new_session=True,
    )

    update_runtime_state(
        runtime_id=runtime_id,
        status="starting",
        model_loaded=False,
        active_model_id=model["id"],
        recommended_model_id=model["id"],
        endpoint=endpoint,
        model_path=str(model_home),
        started_at=time.time(),
        pid=process.pid,
        last_error=None,
    )
    publish("system", "runtime", "runtime.starting", {"runtime_id": runtime_id, "model_id": model["id"], "pid": process.pid})

    deadline = time.time() + 20
    while time.time() < deadline:
        if _request_json(_health_url(endpoint)) is not None:
            health = {
                "ok": True,
                "checked_at": time.time(),
            }
            update_runtime_state(status="running", model_loaded=True, last_health=health)
            publish("system", "runtime", "runtime.started", {"runtime_id": runtime_id, "model_id": model["id"], "endpoint": endpoint})
            return get_runtime_status()
        time.sleep(1.0)

    update_runtime_state(status="error", model_loaded=False, last_error="Runtime failed health check after launch.")
    publish("system", "runtime", "runtime.health.error", {"runtime_id": runtime_id, "endpoint": endpoint}, level="error")
    raise RuntimeError("Runtime failed health check after launch.")


def stop_runtime() -> dict[str, Any]:
    state = get_runtime_state()
    pid = state.get("pid")
    if pid:
        try:
            os.killpg(int(pid), signal.SIGTERM)
        except ProcessLookupError:
            pass
        except Exception as exc:
            update_runtime_state(last_error=str(exc))
    publish("system", "runtime", "runtime.stopped", {"runtime_id": state.get("runtime_id")})
    update_runtime_state(
        status="stopped",
        model_loaded=False,
        endpoint=None,
        pid=None,
        started_at=None,
        last_health={},
        last_error=None,
    )
    return get_runtime_status()
