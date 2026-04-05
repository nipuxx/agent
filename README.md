# Nipux

Nipux is a local-first control plane for running Hermes Agent with the right local model, runtime, and quantization for the machine in front of it.

The core idea is simple:

- `nipuxd` detects hardware, builds an install plan, chooses a runtime, and manages Hermes as an external dependency.
- The web UI talks only to `nipuxd`.
- Hermes stays isolated behind a stable process boundary so upstream Hermes updates do not force UI rewrites.

## Product Direction

Nipux is designed around three jobs:

1. Detect the host and decide whether it should run `Carnice-9b` or `Carnice-27b`.
2. Pick the safest quantization and runtime for the available VRAM, unified memory, and bandwidth budget.
3. Stand up a browser-based interface for chat, agent control, install flow, and Hermes-backed sessions.

The current implementation in this repo includes:

- A FastAPI daemon for hardware detection and planning
- Apple Silicon detection with an `MLX` inference path
- A Next.js web UI with a minimal `vLLM Studio` / `Open WebUI`-inspired layout
- A clean architecture for isolating Hermes Agent from the UI
- Bootstrap scripts for local development

## Repository Layout

```text
docs/                  Architecture and product notes
nipuxd/                Local control daemon
scripts/               Install and development entrypoints
web/                   Browser UI
```

## Quick Start

```bash
git clone https://github.com/nipuxx/agent.git
cd agent
bash scripts/install.sh
bash scripts/dev.sh
```

Then open:

- `http://127.0.0.1:3000`
- or `http://<your-lan-ip>:3000` if you bind onto the network

## Architecture Promise

Nipux does not embed Hermes internals into the UI.

Instead:

- `nipuxd` owns the stable HTTP contract
- Hermes is treated as an external tool/runtime
- Nipux profiles and config live under a managed Nipux directory
- Hermes can be upgraded independently as long as the adapter contract still holds

## Install Philosophy

Nipux does not install runtimes or model weights just because you ran the bootstrap script.

The bootstrap script only installs the Nipux application itself:

- Python dependencies for `nipuxd`
- Node dependencies for the web UI

Runtime installation and model download are intentionally deferred to the UI onboarding flow so the
user can review the machine plan first.

## Current Model Heuristics

Nipux currently assumes the following default ladder:

- `< 8 GB` usable VRAM: unsupported for Carnice
- `8 GB`: `Carnice-9b Q4_K_M`
- `12 GB`: `Carnice-9b Q6_K`
- `16 GB`: `Carnice-9b Q8_0`
- `24 GB`: `Carnice-27b Q4_K_M`
- `32 GB`: `Carnice-27b Q8_0`

For Apple Silicon, Nipux also exposes an `MLX` track based on usable unified-memory budget.

These values are intentionally conservative and are surfaced through the daemon API so they can be tuned without rewriting the frontend.
