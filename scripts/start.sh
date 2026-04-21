#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_HOST="${NIPUX_API_HOST:-0.0.0.0}"
API_PORT="${NIPUX_API_PORT:-9384}"
WEB_HOST="${NIPUX_WEB_HOST:-0.0.0.0}"
WEB_PORT="${NIPUX_WEB_PORT:-3000}"
LOG_DIR="${NIPUX_LOG_DIR:-$ROOT/.nipux}"
API_LOG="${NIPUX_API_LOG:-$LOG_DIR/api.log}"
WEB_LOG="${NIPUX_WEB_LOG:-$LOG_DIR/web.log}"
API_PID_FILE="${NIPUX_API_PID_FILE:-$LOG_DIR/api.pid}"
WEB_PID_FILE="${NIPUX_WEB_PID_FILE:-$LOG_DIR/web.pid}"
START_TIMEOUT="${NIPUX_START_TIMEOUT:-30}"

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
  pkill -f "next-server" >/dev/null 2>&1 || true
  pkill -f "next start --hostname" >/dev/null 2>&1 || true
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

mkdir -p "$LOG_DIR"
stop_existing

source "$ROOT/.venv/bin/activate"
export NIPUXD_URL="http://127.0.0.1:${API_PORT}"
export NODE_ENV=production

cd "$ROOT/web"
npm run build

cd "$ROOT"
nohup python -m uvicorn nipuxd.app.main:app --app-dir "$ROOT" --host "$API_HOST" --port "$API_PORT" >"$API_LOG" 2>&1 &
API_PID=$!
echo "$API_PID" >"$API_PID_FILE"

cd "$ROOT/web"
nohup ./node_modules/.bin/next start --hostname "$WEB_HOST" --port "$WEB_PORT" >"$WEB_LOG" 2>&1 &
WEB_PID=$!
echo "$WEB_PID" >"$WEB_PID_FILE"

deadline=$((SECONDS + START_TIMEOUT))
api_ready=0
web_ready=0
while [ "$SECONDS" -lt "$deadline" ]; do
  if [ "$api_ready" -eq 0 ] && curl -fsS "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
    api_ready=1
  fi
  if [ "$web_ready" -eq 0 ] && curl -I -fsS "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then
    web_ready=1
  fi
  if [ "$api_ready" -eq 1 ] && [ "$web_ready" -eq 1 ]; then
    break
  fi
  sleep 1
done

if [ "$api_ready" -ne 1 ] || [ "$web_ready" -ne 1 ]; then
  echo "Nipux failed to start cleanly."
  echo "--- API log ---"
  tail -n 40 "$API_LOG" || true
  echo "--- Web log ---"
  tail -n 40 "$WEB_LOG" || true
  exit 1
fi

echo "Nipux started."
echo "API: http://127.0.0.1:${API_PORT}"
echo "Web: http://127.0.0.1:${WEB_PORT}"
echo "Logs: $API_LOG $WEB_LOG"
