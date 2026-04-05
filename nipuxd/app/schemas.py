from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class SummaryResponse(BaseModel):
    product: str
    system: dict[str, Any]
    hermes: dict[str, Any]
    runtime: dict[str, Any]
    recommendation: dict[str, Any]
    api_reference: dict[str, Any] | None = None
    install_plan: dict[str, Any]
    model_catalog: list[dict[str, Any]]
    runtime_catalog: list[dict[str, Any]]
