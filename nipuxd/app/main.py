from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .catalog import MODEL_CATALOG, RUNTIME_PROFILES
from .detection import detect_system
from .hermes_bridge import get_hermes_status
from .planner import build_install_plan, choose_model, choose_runtime
from .pricing import get_openrouter_reference_for_size
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
    recommendation = choose_model(system)
    runtime = choose_runtime(system, recommendation.get("selected"))
    api_reference = get_openrouter_reference_for_size(
        recommendation.get("selected", {}).get("size") if recommendation.get("selected") else None
    )
    install_plan = build_install_plan(system, recommendation, runtime, hermes)
    return SummaryResponse(
        product="Nipux",
        system=system,
        hermes=hermes,
        runtime=runtime,
        recommendation=recommendation,
        api_reference=api_reference,
        install_plan=install_plan,
        model_catalog=MODEL_CATALOG,
        runtime_catalog=RUNTIME_PROFILES,
    )


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "nipuxd"}


@app.get("/api/summary", response_model=SummaryResponse)
def summary() -> SummaryResponse:
    return build_summary()
