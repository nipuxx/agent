# Nipux

Nipux is a local-first control plane for long-running agents. It picks the right local runtime for the host, exposes a stable web UI, and runs a Nipux-native harness built around runs, tasks, checkpoints, browser sessions, and durable logs.

## Product Direction

Nipux is built around four jobs:

1. Detect the host and choose the right local runtime path.
2. Pick a compatible Carnice model and quantization for the available VRAM, unified memory, and bandwidth budget.
3. Run bounded long-horizon agent loops with checkpoints, live browser control, and persisted state.
4. Expose all of that through one local web interface.

## Repository Layout

```text
docs/                  Architecture and product notes
nipuxd/                Local control daemon and agent harness
scripts/               Install and development entrypoints
web/                   Browser UI
```

## One Command

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/nipuxx/agent/main/scripts/bootstrap.sh)
```

That will:

- clone or update Nipux into `~/nipux`
- install Python and web dependencies
- start Nipux on the current machine
- expose the UI on `http://<server-ip>:3000`

Override defaults if needed:

```bash
NIPUX_DIR=/opt/nipux NIPUX_REPO_REF=main NIPUX_START=1 bash <(curl -fsSL https://raw.githubusercontent.com/nipuxx/agent/main/scripts/bootstrap.sh)
```

## Manual Start

```bash
git clone https://github.com/nipuxx/agent.git
cd agent
bash scripts/install.sh
bash scripts/start.sh
```

Then open:

- `http://<server-ip>:3000`

First load goes to `/setup` so you can choose the runtime, model, and install options.

For local frontend development instead:

```bash
bash scripts/dev.sh
```

## Current Architecture

The main boundary is simple:

- the web UI talks only to `nipuxd`
- `nipuxd` owns hardware detection, runtime management, state storage, browser control, and long-run orchestration
- the agent harness is Nipux-native, not delegated to Hermes

## Runtime Philosophy

Nipux does not install runtimes or model weights just because the repo was bootstrapped.

The bootstrap script installs:

- Python dependencies for `nipuxd`
- Playwright + Chromium for browser sessions
- Node dependencies for the web UI

Model/runtime installation stays behind the UI so the user can review the machine plan first.
