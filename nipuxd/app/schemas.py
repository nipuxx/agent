from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class SummaryResponse(BaseModel):
    product: str
    system: dict[str, Any]
    telemetry: dict[str, Any]
    hermes: dict[str, Any]
    settings: dict[str, Any]
    runtime_state: dict[str, Any]
    nodes: list[dict[str, Any]]
    log_lines: list[str]
    usage_summary: dict[str, Any]
    api_reference: dict[str, Any] | None = None
    agents: list[dict[str, Any]]
