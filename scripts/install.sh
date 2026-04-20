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
python -m playwright install chromium

cd "$ROOT/web"
npm install

echo
echo "Nipux dependencies are installed."
echo
echo "Next steps:"
echo "  1. bash scripts/start.sh"
echo "  2. Open http://<server-ip>:3000"
echo
echo "For frontend development instead:"
echo "  bash scripts/dev.sh"
echo
echo "First load goes to /setup so you can choose the runtime, model, and install options."
