#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$ROOT/.venv" ]; then
  echo "Missing Python environment. Run: bash scripts/install.sh"
  exit 1
fi

if [ ! -d "$ROOT/web/node_modules" ]; then
  echo "Missing web dependencies. Run: bash scripts/install.sh"
  exit 1
fi

cleanup() {
  if [ -n "${API_PID:-}" ] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

source "$ROOT/.venv/bin/activate"
python -m uvicorn nipuxd.app.main:app --app-dir "$ROOT" --host 0.0.0.0 --port 9384 &
API_PID=$!

cd "$ROOT/web"
npm run dev -- --hostname 0.0.0.0

