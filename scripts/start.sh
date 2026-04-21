#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_HOST="${NIPUX_API_HOST:-0.0.0.0}"
API_PORT="${NIPUX_API_PORT:-9384}"
WEB_HOST="${NIPUX_WEB_HOST:-0.0.0.0}"
WEB_PORT="${NIPUX_WEB_PORT:-3000}"

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
  pkill -f "$ROOT/web/node_modules/.bin/next dev" >/dev/null 2>&1 || true
  pkill -f "$ROOT/web/node_modules/.bin/next start" >/dev/null 2>&1 || true
  pkill -f "bash scripts/dev.sh" >/dev/null 2>&1 || true
  pkill -f "npm run dev" >/dev/null 2>&1 || true
  pkill -f "npm exec next start --hostname" >/dev/null 2>&1 || true
  kill_listeners "$API_PORT" "$WEB_PORT"
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
export NIPUXD_URL="http://127.0.0.1:${API_PORT}"
export NODE_ENV=production

python -m uvicorn nipuxd.app.main:app --app-dir "$ROOT" --host "$API_HOST" --port "$API_PORT" &
API_PID=$!

cd "$ROOT/web"
npm run build
npx next start --hostname "$WEB_HOST" --port "$WEB_PORT"
