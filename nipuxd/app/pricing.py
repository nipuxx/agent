from __future__ import annotations

import json
import time
from urllib.request import Request, urlopen

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
OPENROUTER_MODEL_IDS = {
    "9B": "qwen/qwen3.5-9b",
    "27B": "qwen/qwen3.5-27b",
}
_CACHE_TTL_SECONDS = 900
_CACHE: dict[str, object] = {
    "expires_at": 0.0,
    "catalog": {},
}


def _fetch_openrouter_catalog() -> dict[str, dict]:
    now = time.time()
    expires_at = float(_CACHE.get("expires_at", 0.0) or 0.0)
    if now < expires_at:
        return _CACHE.get("catalog", {})  # type: ignore[return-value]

    request = Request(
        OPENROUTER_MODELS_URL,
        headers={"User-Agent": "Nipux/0.1 (+https://github.com/nipuxx/agent)"},
    )
    with urlopen(request, timeout=8) as response:
        payload = json.load(response)

    catalog: dict[str, dict] = {}
    for item in payload.get("data", []):
        model_id = item.get("id")
        if model_id not in OPENROUTER_MODEL_IDS.values():
            continue

        pricing = item.get("pricing") or {}
        prompt_per_million = float(pricing.get("prompt", 0.0) or 0.0) * 1_000_000
        completion_per_million = float(pricing.get("completion", 0.0) or 0.0) * 1_000_000

        catalog[model_id] = {
            "provider": "OpenRouter",
            "model_id": model_id,
            "label": item.get("name") or model_id,
            "prompt_per_million_usd": round(prompt_per_million, 3),
            "completion_per_million_usd": round(completion_per_million, 3),
            "blended_per_million_usd": round(prompt_per_million + completion_per_million, 3),
            "context_length": item.get("context_length"),
            "source_url": f"https://openrouter.ai/{model_id}",
            "checked_at": int(now),
        }

    _CACHE["catalog"] = catalog
    _CACHE["expires_at"] = now + _CACHE_TTL_SECONDS
    return catalog


def get_openrouter_reference_for_size(size: str | None) -> dict | None:
    if not size:
        return None

    model_id = OPENROUTER_MODEL_IDS.get(size.upper())
    if not model_id:
        return None

    try:
        catalog = _fetch_openrouter_catalog()
    except Exception:
        return None

    return catalog.get(model_id)
