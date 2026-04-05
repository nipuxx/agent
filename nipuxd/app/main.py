from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .catalog import MODEL_CATALOG
from .detection import detect_system
from .hermes_bridge import get_hermes_status
from .planner import build_install_plan, choose_model, choose_runtime
from .schemas import SummaryResponse

app = FastAPI(title="Nipux Daemon", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_summary() -> SummaryResponse:
    system = detect_system()
    hermes = get_hermes_status()
    recommendation = choose_model(system["gpus"], system["ram_gb"])
    runtime = choose_runtime(system["gpus"], recommendation.get("selected"))
    install_plan = build_install_plan(system, recommendation, runtime, hermes)
    return SummaryResponse(
        product="Nipux",
        system=system,
        hermes=hermes,
        runtime=runtime,
        recommendation=recommendation,
        install_plan=install_plan,
        model_catalog=MODEL_CATALOG,
    )


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "nipuxd"}


@app.get("/api/summary", response_model=SummaryResponse)
def summary() -> SummaryResponse:
    return build_summary()
