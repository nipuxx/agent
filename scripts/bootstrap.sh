#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${NIPUX_REPO_URL:-https://github.com/nipuxx/agent.git}"
REPO_REF="${NIPUX_REPO_REF:-main}"
INSTALL_DIR="${NIPUX_DIR:-$HOME/nipux}"
START_AFTER_INSTALL="${NIPUX_START:-1}"
LOG_PATH="${NIPUX_LOG_PATH:-/tmp/nipux-start.log}"

kill_listeners() {
  local port
  for port in "$@"; do
    if command -v lsof >/dev/null 2>&1; then
      lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | xargs -r kill >/dev/null 2>&1 || true
      sleep 1
      lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | xargs -r kill -9 >/dev/null 2>&1 || true
    elif command -v fuser >/dev/null 2>&1; then
      fuser -k "${port}/tcp" >/dev/null 2>&1 || true
    fi
  done
}

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing required command: $name"
    exit 1
  fi
}

require_command git
require_command bash
require_command python3
require_command npm
require_command curl

echo "==> Nipux bootstrap"
echo "    repo: $REPO_URL"
echo "    ref:  $REPO_REF"
echo "    dir:  $INSTALL_DIR"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "==> Updating existing checkout"
  git -C "$INSTALL_DIR" fetch origin
  git -C "$INSTALL_DIR" checkout "$REPO_REF"
  git -C "$INSTALL_DIR" pull --ff-only origin "$REPO_REF"
else
  echo "==> Cloning Nipux"
  rm -rf "$INSTALL_DIR"
  git clone --branch "$REPO_REF" --single-branch "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
bash scripts/install.sh

if [ "$START_AFTER_INSTALL" = "1" ]; then
  echo "==> Starting Nipux"
  pkill -f "uvicorn nipuxd.app.main:app" >/dev/null 2>&1 || true
  pkill -f "$INSTALL_DIR/web/node_modules/.bin/next dev" >/dev/null 2>&1 || true
  pkill -f "next start --hostname" >/dev/null 2>&1 || true
  pkill -f "bash scripts/dev.sh" >/dev/null 2>&1 || true
  kill_listeners 9384 3000
  if ! bash scripts/start.sh 2>&1 | tee "$LOG_PATH"; then
    echo "Nipux did not come up cleanly. Check:"
    echo "  $LOG_PATH"
    exit 1
  fi
  echo
  echo "Nipux is up."
  echo "Open:"
  echo "  http://$(hostname -I | awk '{print $1}'):3000"
  echo
  echo "Logs:"
  echo "  $LOG_PATH"
else
  echo
  echo "Nipux is installed."
  echo "Start it with:"
  echo "  cd $INSTALL_DIR && bash scripts/start.sh"
fi
