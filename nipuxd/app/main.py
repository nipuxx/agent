from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .catalog import MODEL_CATALOG, RUNTIME_PROFILES
from .detection import detect_system
from .hermes_bridge import get_hermes_status
from .planner import build_install_plan, choose_model, choose_runtime
from .pricing import get_openrouter_reference_for_size
from .schemas import SummaryResponse
from .state import (
    AGENT_CATALOG,
    build_agents_summary,
    build_runtime_state,
    build_usage_summary,
    load_state,
    set_agent_status,
    set_runtime_loaded,
    set_runtime_unloaded,
)

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
    state = load_state(recommendation.get("selected_model_id"))
    install_plan = build_install_plan(system, recommendation, runtime, hermes)
    return SummaryResponse(
        product="Nipux",
        system=system,
        hermes=hermes,
        runtime=runtime,
        recommendation=recommendation,
        api_reference=api_reference,
        runtime_state=build_runtime_state(state, recommendation),
        usage_summary=build_usage_summary(
            state,
            api_reference,
            recommendation.get("estimated_cost_per_million_tokens_usd"),
        ),
        agents=build_agents_summary(state),
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


@app.post("/api/runtime/load", response_model=SummaryResponse)
def load_runtime() -> SummaryResponse:
    selected_model_id = choose_model(detect_system()).get("selected_model_id")
    set_runtime_loaded(selected_model_id)
    return build_summary()


@app.post("/api/runtime/unload", response_model=SummaryResponse)
def unload_runtime() -> SummaryResponse:
    selected_model_id = choose_model(detect_system()).get("selected_model_id")
    set_runtime_unloaded(selected_model_id)
    return build_summary()


@app.post("/api/agents/{agent_id}/start", response_model=SummaryResponse)
def start_agent(agent_id: str) -> SummaryResponse:
    if agent_id not in {agent["id"] for agent in AGENT_CATALOG}:
        raise HTTPException(status_code=404, detail="Unknown agent")
    selected_model_id = choose_model(detect_system()).get("selected_model_id")
    set_agent_status(agent_id, True, selected_model_id)
    return build_summary()


@app.post("/api/agents/{agent_id}/stop", response_model=SummaryResponse)
def stop_agent(agent_id: str) -> SummaryResponse:
    if agent_id not in {agent["id"] for agent in AGENT_CATALOG}:
        raise HTTPException(status_code=404, detail="Unknown agent")
    selected_model_id = choose_model(detect_system()).get("selected_model_id")
    set_agent_status(agent_id, False, selected_model_id)
    return build_summary()
