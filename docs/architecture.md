# Nipux Architecture

## Goals

Nipux needs to do four things at once:

1. Install and run the right local inference stack for the host.
2. Expose a clean web UI for runs, chat, agents, browser control, and settings.
3. Keep long-horizon state durable so work can run for hours or days.
4. Verify progress with checkpoints instead of trusting one giant transcript.

## Boundary

The important design choice is that the frontend never talks to a model runtime directly and never owns long-run agent state.

The layers are:

```text
Browser UI
  -> Nipux HTTP API
    -> SQLite state + event log
    -> Runtime manager
    -> Browser service
    -> Orchestrator / worker harness
      -> local model runtime (MLX / vLLM / llama.cpp or external OpenAI-compatible endpoint)
```

## Core Services

### `nipuxd`

`nipuxd` is the source of truth for:

- hardware detection
- runtime recommendation
- model/quant recommendation
- install planning
- agent records
- thread, run, task, checkpoint, and artifact state
- normalized event logs

### Runtime Manager

The runtime manager chooses and controls local inference:

- prefer `MLX` on Apple Silicon
- prefer `vLLM` on NVIDIA/CUDA hosts that can sustain it
- fall back to `llama.cpp` for broad GGUF compatibility

### Browser Service

Browser control is a first-class subsystem:

- one browser session per agent
- Playwright + Chromium
- live frame endpoint for the UI
- user takeover via manual mode

### Harness

The harness is built around:

- runs
- task nodes
- bounded worker loops
- checkpoints
- artifacts
- verifier-driven progress

The critical rule is that accepted progress gets checkpointed into durable state; the agent does not depend on replaying an unbounded transcript.
