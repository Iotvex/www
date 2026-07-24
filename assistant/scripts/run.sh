#!/usr/bin/env bash
# iotvex-assistant startup script
# Usage: bash scripts/run.sh [--port 8777] [--debug]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

VENV_DIR="$PROJECT_DIR/.venv"
PYTHON="${VENV_DIR}/bin/python"
PIP="${VENV_DIR}/bin/pip"

# ── Parse args ───────────────────────────────────────────────────────────────
PORT="${PORT:-8777}"
HOST="${HOST:-0.0.0.0}"
DEBUG_FLAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)    PORT="$2"; shift 2 ;;
    --host)    HOST="$2"; shift 2 ;;
    --debug)   DEBUG_FLAG="--reload"; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ── Create venv if needed ────────────────────────────────────────────────────
if [[ ! -f "$PYTHON" ]]; then
  echo "Creating virtual environment in .venv …"
  python3 -m venv "$VENV_DIR"
fi

# ── Install / upgrade dependencies ───────────────────────────────────────────
echo "Installing dependencies …"
"$PIP" install --quiet --upgrade pip
"$PIP" install --quiet -r requirements.txt

# ── Copy .env if not present ─────────────────────────────────────────────────
if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  if [[ -f "$PROJECT_DIR/.env.example" ]]; then
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    echo "Copied .env.example → .env  (edit it with your IOTVEX_WWW_URL and token)"
  fi
fi

# ── Launch ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Iotvex Assistant                        ║"
echo "║  Wake word : Alexa / Алекса              ║"
echo "║  TTS       : ru-RU-SvetlanaNeural        ║"
echo "║  URL       : http://${HOST}:${PORT}      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

export HOST="$HOST"
export PORT="$PORT"

"${VENV_DIR}/bin/uvicorn" app.main:app \
  --host "$HOST" \
  --port "$PORT" \
  --log-level info \
  $DEBUG_FLAG
