from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class SummaryResponse(BaseModel):
    product: str
    system: dict[str, Any]
    hermes: dict[str, Any]
    runtime: dict[str, Any]
    recommendation: dict[str, Any]
    install_plan: dict[str, Any]
    model_catalog: list[dict[str, Any]]

