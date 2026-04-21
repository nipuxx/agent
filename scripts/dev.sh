#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

stop_existing() {
  pkill -f "uvicorn nipuxd.app.main:app --app-dir $ROOT" >/dev/null 2>&1 || true
  pkill -f "$ROOT/web/node_modules/.bin/next start" >/dev/null 2>&1 || true
  pkill -f "$ROOT/web/node_modules/.bin/next dev" >/dev/null 2>&1 || true
  pkill -f "bash scripts/start.sh" >/dev/null 2>&1 || true
  pkill -f "npm exec next start --hostname" >/dev/null 2>&1 || true
  kill_listeners 9384 3000
  sleep 1
}

if [ ! -d "$ROOT/.venv" ]; then
  echo "Missing Python environment. Run: bash scripts/install.sh"
  exit 1
fi

if [ ! -d "$ROOT/web/node_modules" ]; then
  echo "Missing web dependencies. Run: bash scripts/install.sh"
  exit 1
fi

stop_existing

cleanup() {
  if [ -n "${API_PID:-}" ] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

source "$ROOT/.venv/bin/activate"
export NODE_ENV=development
python -m uvicorn nipuxd.app.main:app --app-dir "$ROOT" --host 0.0.0.0 --port 9384 &
API_PID=$!

cd "$ROOT/web"
npm run dev
