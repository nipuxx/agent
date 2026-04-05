# Nipux Architecture

## Goals

Nipux needs to do three things at once:

1. Install and run the right local inference stack for the host.
2. Expose a clean web UI for chat, setup, and agent control.
3. Survive Hermes Agent churn without breaking the frontend every time upstream changes its internals.

## The Boundary

The important design choice is that the frontend never imports Hermes code and never depends on Hermes data structures directly.

The layers are:

```text
Browser UI
  -> Nipux HTTP API
    -> Runtime Manager
    -> Model Planner
    -> Hermes Adapter
      -> Hermes CLI / Hermes-managed profile / local model server
```

## Why This Matters

Hermes Agent moves fast. If the web app imported Hermes internals directly, every upstream refactor would become a frontend breakage risk.

Nipux avoids that by using:

- managed Hermes install paths
- managed Nipux-owned config and profile paths
- subprocess boundaries
- a narrow adapter layer that translates Nipux session intents into Hermes process calls

## Services

### `nipuxd`

`nipuxd` is the source of truth for:

- hardware detection
- runtime recommendation
- model/quant recommendation
- install planning
- Hermes install status
- Nipux-managed profile paths

### Hermes Adapter

The Hermes adapter is responsible for:

- detecting Hermes installation and version
- maintaining a Nipux-owned Hermes home/profile
- launching Hermes processes in a controlled environment
- translating process-level events into stable API responses

This allows Nipux to keep using upstream Hermes while limiting the surface area that can break.

## Runtime Strategy

Nipux should choose runtimes conservatively:

- Prefer `vLLM` on NVIDIA hosts with enough VRAM
- Prefer `llama.cpp` for low-VRAM or broad compatibility paths
- Fall back cleanly when hardware capability is uncertain

The planner should not just chase VRAM. It should also consider:

- vendor support
- memory bandwidth hints
- quantization fit
- disk footprint
- whether the selected runtime can actually serve the chosen model

## Frontend Strategy

The UI is intentionally product-oriented:

- `Dashboard`: what the machine can do right now
- `Setup`: confirm hardware, runtime, model, download, and launch flow
- `Chat`: model and Hermes-backed conversations
- `Agents`: specialized agent surfaces and system roles

The visual system is inspired by control-plane products rather than generic chat apps:

- dense but readable metric strips
- strong information hierarchy
- warm/dark surfaces with bright accent tokens
- compact side navigation
- clean cards over giant empty whitespace

