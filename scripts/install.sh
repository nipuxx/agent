#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

echo "==> Nipux bootstrap"
echo "    root: $ROOT"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Python 3 is required."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required."
  exit 1
fi

if [ ! -d "$ROOT/.venv" ]; then
  "$PYTHON_BIN" -m venv "$ROOT/.venv"
fi

source "$ROOT/.venv/bin/activate"
python -m pip install --upgrade pip >/dev/null
python -m pip install -r "$ROOT/nipuxd/requirements.txt"

cd "$ROOT/web"
npm install

echo
echo "Nipux dependencies are installed."
echo
echo "Next steps:"
echo "  1. bash scripts/dev.sh"
echo "  2. Open http://127.0.0.1:3000"
echo
echo "Hermes and runtime installation are intentionally managed through Nipux planning,"
echo "not hard-wired into the frontend."

