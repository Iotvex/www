#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export IOTVEX_WWW_ROOT="$ROOT"
export IOTVEX_CONFIG_DIR="${IOTVEX_CONFIG_DIR:-$ROOT/config}"
exec python3 "$ROOT/scripts/publish-manager.py" "$@"
