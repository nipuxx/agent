from __future__ import annotations

from typing import Any

from .db import get_app_settings
from .runtime_manager import get_runtime_status, start_runtime


def resolve_model_connection(
    *,
    runtime_policy: dict[str, Any] | None = None,
    model_policy: dict[str, Any] | None = None,
) -> tuple[str, str, str]:
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
        policy = runtime_policy or {}
        policy_model = model_policy or {}
        if policy.get("mode") != "external":
            runtime = start_runtime(
                runtime_id=policy.get("runtime_id") if policy.get("mode") not in {None, "auto"} else None,
                model_id=policy_model.get("model_id") if policy_model.get("mode") not in {None, "auto"} else None,
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
        raise RuntimeError(
            "No active model endpoint is configured. Start a runtime or set an external OpenAI-compatible endpoint in Settings."
        )
    return endpoint, api_key, model
