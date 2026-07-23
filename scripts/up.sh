#!/usr/bin/env bash
# Bootstrap Iotvex www on the home machine.
# Device plane (agent/OTBR) is expected to already run locally.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IOTVEX_DB_MODE="${IOTVEX_DB_MODE:-local}"
IOTVEX_WWW_MODE="${IOTVEX_WWW_MODE:-local_published}"
# legacy aliases
case "$IOTVEX_WWW_MODE" in lan) IOTVEX_WWW_MODE=local ;; published) IOTVEX_WWW_MODE=local_published ;; esac
case "${IOTVEX_DB_MODE:-local}" in remote) IOTVEX_DB_MODE=cloud_private ;; esac
IOTVEX_MDNS_NAME="${IOTVEX_MDNS_NAME:-iotvex.local}"
IOTVEX_AGENT_URL="${IOTVEX_AGENT_URL:-http://127.0.0.1:7421}"

# Preserve hand-tuned secrets across re-bootstrap.
EXISTING_CRON_SECRET=""
EXISTING_IOTVEX_TZ=""
EXISTING_REMOTE_URL=""
EXISTING_ANON=""
EXISTING_SERVICE=""
EXISTING_BROWSER=""
if [[ -f .env.local ]]; then
  EXISTING_CRON_SECRET="$(grep -E '^CRON_SECRET=' .env.local | head -1 | cut -d= -f2- || true)"
  EXISTING_IOTVEX_TZ="$(grep -E '^IOTVEX_TZ=' .env.local | head -1 | cut -d= -f2- || true)"
  EXISTING_REMOTE_URL="$(grep -E '^SUPABASE_URL=' .env.local | head -1 | cut -d= -f2- || true)"
  EXISTING_ANON="$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | head -1 | cut -d= -f2- || true)"
  EXISTING_SERVICE="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | head -1 | cut -d= -f2- || true)"
  EXISTING_BROWSER="$(grep -E '^NEXT_PUBLIC_SUPABASE_BROWSER_URL=' .env.local | head -1 | cut -d= -f2- || true)"
fi

CRON_SECRET="${EXISTING_CRON_SECRET:-$(openssl rand -hex 16)}"
HOST_TZ="$(timedatectl show -p Timezone --value 2>/dev/null || true)"
IOTVEX_TZ="${IOTVEX_TZ:-${EXISTING_IOTVEX_TZ:-${HOST_TZ:-Europe/Moscow}}}"

if [[ "$IOTVEX_DB_MODE" == "remote" ]]; then
  echo "==> DB mode: remote (user-owned Supabase) — skipping local supabase start"
  API_URL="${SUPABASE_URL:-${EXISTING_REMOTE_URL:-}}"
  ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${ANON_KEY:-${EXISTING_ANON:-}}}"
  SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-${SERVICE_ROLE_KEY:-${EXISTING_SERVICE:-}}}"
  if [[ -z "$API_URL" || -z "$ANON_KEY" || -z "$SERVICE_ROLE_KEY" ]]; then
    echo "ERROR: remote DB requires SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY" >&2
    echo "Example:" >&2
    echo "  IOTVEX_DB_MODE=remote SUPABASE_URL=https://xxxx.supabase.co \\" >&2
    echo "    NEXT_PUBLIC_SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... ./scripts/up.sh" >&2
    exit 1
  fi
  BROWSER_URL="${NEXT_PUBLIC_SUPABASE_BROWSER_URL:-${EXISTING_BROWSER:-$API_URL}}"
else
  echo "==> DB mode: local — start lean Supabase (db+auth+rest+kong)"
  if [[ "${SUPABASE_FULL:-}" == "1" ]]; then
    echo "    SUPABASE_FULL=1 — no --exclude (still respects enabled= in config.toml)"
    supabase start
  else
    supabase start --exclude realtime,storage-api,imgproxy,mailpit,studio,postgres-meta,edge-runtime,logflare,vector
  fi
  echo "==> Export keys"
  eval "$(supabase status -o env)"
  API_URL="${API_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
  BROWSER_URL="${NEXT_PUBLIC_SUPABASE_BROWSER_URL:-/supabase}"
fi

SEED_EMAIL="${SEED_EMAIL:-xlebpushek@gmail.com}"
SEED_PASSWORD="${SEED_PASSWORD:-9851}"

cat > .env.local <<ENVLOCAL
IOTVEX_WWW_MODE=${IOTVEX_WWW_MODE}
IOTVEX_DB_MODE=${IOTVEX_DB_MODE}
IOTVEX_MDNS_NAME=${IOTVEX_MDNS_NAME}
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SUPABASE_URL=${API_URL}
SUPABASE_ANON_KEY=${ANON_KEY}
NEXT_PUBLIC_SUPABASE_BROWSER_URL=${BROWSER_URL}
IOTVEX_AGENT_URL=${IOTVEX_AGENT_URL}
REDIS_URL=redis://127.0.0.1:6379
CRON_SECRET=${CRON_SECRET}
IOTVEX_TZ=${IOTVEX_TZ}
TZ=${IOTVEX_TZ}
SEED_EMAIL=${SEED_EMAIL}
SEED_PASSWORD=${SEED_PASSWORD}
ENVLOCAL

umask 077
cat > .env.cron <<ENVCRON
CRON_SECRET=${CRON_SECRET}
IOTVEX_TZ=${IOTVEX_TZ}
TZ=${IOTVEX_TZ}
ENVCRON
chmod 600 .env.cron

if [[ "$IOTVEX_DB_MODE" == "local" ]]; then
  echo "==> Seed admin user"
  node scripts/seed-user.mjs
else
  echo "==> Remote DB — skip local seed-user (create users in your Supabase project)"
fi

echo "==> Build & start web+redis on :3100"
docker compose up -d --build

if [[ "$IOTVEX_WWW_MODE" == "local_published" || "${INSTALL_HTTPS:-}" == "1" ]]; then
  if [[ -x "$ROOT/scripts/install-https.sh" ]] && command -v caddy >/dev/null 2>&1; then
    if [[ "${EUID}" -eq 0 ]]; then
      "$ROOT/scripts/install-https.sh"
    elif sudo -n true 2>/dev/null; then
      sudo "$ROOT/scripts/install-https.sh"
    else
      echo "NOTE: run sudo $ROOT/scripts/install-https.sh for HTTPS :8443"
    fi
  fi
elif [[ -x "$ROOT/scripts/install-https.sh" ]] && command -v caddy >/dev/null 2>&1; then
  if systemctl is-active --quiet caddy 2>/dev/null; then
    echo "==> Caddy already active (LAN HTTPS :8443)"
  else
    echo "NOTE: optional LAN HTTPS: sudo $ROOT/scripts/install-https.sh"
  fi
fi

if [[ "${INSTALL_MDNS:-}" == "1" ]] && [[ -x "$ROOT/scripts/install-mdns.sh" ]]; then
  if [[ "${EUID}" -eq 0 ]]; then
    "$ROOT/scripts/install-mdns.sh"
  elif sudo -n true 2>/dev/null; then
    sudo IOTVEX_MDNS_NAME="$IOTVEX_MDNS_NAME" "$ROOT/scripts/install-mdns.sh"
  else
    echo "NOTE: run sudo IOTVEX_MDNS_NAME=$IOTVEX_MDNS_NAME $ROOT/scripts/install-mdns.sh"
  fi
fi

if [[ -f /home/xlebpushek/iotvex/hub/scripts/systemd/iotvex-automations.timer ]]; then
  if [[ "${EUID}" -eq 0 ]] || sudo -n true 2>/dev/null; then
    SUDO=()
    [[ "${EUID}" -eq 0 ]] || SUDO=(sudo)
    "${SUDO[@]}" cp /home/xlebpushek/iotvex/hub/scripts/systemd/iotvex-automations.service /etc/systemd/system/
    "${SUDO[@]}" cp /home/xlebpushek/iotvex/hub/scripts/systemd/iotvex-automations.timer /etc/systemd/system/
    "${SUDO[@]}" systemctl daemon-reload
    "${SUDO[@]}" systemctl enable --now iotvex-automations.timer
    echo "==> Home automations timer enabled (systemd → 127.0.0.1:3100)"
  else
    echo "NOTE: install automations timer from hub/scripts/systemd/"
  fi
fi

HOST_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')"
HOST_IP="${HOST_IP:-127.0.0.1}"
rm -f /home/xlebpushek/iotvex/www-public-url.txt 2>/dev/null || true
echo
echo "=== Iotvex www ready ==="
echo "Modes: www=${IOTVEX_WWW_MODE}  db=${IOTVEX_DB_MODE}  agent=${IOTVEX_AGENT_URL}"
echo "Dashboard HTTP:  http://${HOST_IP}:3100"
echo "Dashboard HTTPS: https://${HOST_IP}:8443  (if Caddy installed)"
echo "mDNS (optional): https://${IOTVEX_MDNS_NAME}:8443  (INSTALL_MDNS=1)"
if [[ "$IOTVEX_WWW_MODE" == "local_published" ]]; then
  echo "Published: forward WAN → :8443 and point your domain / trust your certs."
fi
echo "Automations: home systemd timer (config in DB, ticks on this host → local agent)"
echo "Login seed (local DB): ${SEED_EMAIL}"
