#!/usr/bin/env bash
# Bootstrap Iotvex www on the home machine (local-only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IOTVEX_MDNS_NAME="${IOTVEX_MDNS_NAME:-iotvex.local}"
IOTVEX_AGENT_URL="${IOTVEX_AGENT_URL:-http://127.0.0.1:7421}"
IOTVEX_TZ="${IOTVEX_TZ:-${TZ:-Europe/Saratov}}"

export IOTVEX_MDNS_NAME IOTVEX_AGENT_URL IOTVEX_TZ TZ="$IOTVEX_TZ"

mkdir -p config
if [[ ! -f config/runtime.json ]]; then
  cat > config/runtime.json <<EOF
{
  "version": 2,
  "mdnsName": "$IOTVEX_MDNS_NAME",
  "timezone": "$IOTVEX_TZ",
  "httpPort": 80,
  "db": {
    "local": {
      "url": "http://host.docker.internal:54321",
      "browserUrl": "/supabase"
    }
  }
}
EOF
fi

docker compose up -d --build
echo "Iotvex www is local-only on port 80 (mDNS: $IOTVEX_MDNS_NAME)"
