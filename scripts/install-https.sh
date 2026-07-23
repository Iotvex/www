#!/usr/bin/env bash
# Install LAN/WAN HTTPS for www on :8443 (no Cloudflare / no fixed hostname).
# Safe to re-run. Requires root.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TLS_DIR=/var/lib/iotvex/tls
CADDY_SRC="$ROOT/deploy/Caddyfile"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Need root. Re-run: sudo $0"
  exit 1
fi

if ! command -v caddy >/dev/null 2>&1; then
  echo "caddy not found — install caddy first"
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl not found"
  exit 1
fi

mkdir -p "$TLS_DIR"

# Collect addresses for cert SAN (warning UX only — TLS works for any Host anyway).
SANS=("DNS:localhost" "DNS:iotvex.local" "IP:127.0.0.1")
while read -r ip; do
  [[ -n "$ip" ]] || continue
  SANS+=("IP:${ip}")
done < <(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | sort -u)

# Best-effort public IPv4 (may differ from router "static" IP; still useful as SAN).
PUB="$(curl -4 -fsS --connect-timeout 3 https://api.ipify.org 2>/dev/null || true)"
if [[ -n "${PUB}" ]]; then
  SANS+=("IP:${PUB}")
fi

# Deduplicate
SAN_CSV="$(printf '%s\n' "${SANS[@]}" | awk '!seen[$0]++' | paste -sd, -)"

echo "==> TLS cert SANs: ${SAN_CSV}"
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout "$TLS_DIR/key.pem" \
  -out "$TLS_DIR/cert.pem" \
  -subj "/CN=iotvex-www" \
  -addext "subjectAltName=${SAN_CSV}" >/dev/null

CADDY_USER=caddy
id "$CADDY_USER" >/dev/null 2>&1 || CADDY_USER=root
chown -R "$CADDY_USER:$CADDY_USER" "$TLS_DIR"
chmod 750 "$TLS_DIR"
chmod 640 "$TLS_DIR/key.pem"
chmod 644 "$TLS_DIR/cert.pem"

install -m 644 "$CADDY_SRC" /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy

LAN="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')"
LAN="${LAN:-<lan-ip>}"
echo
echo "HTTPS ready on all interfaces:"
echo "  https://${LAN}:8443"
echo "  https://<router-static-ip>:8443   (forward WAN:8443 → ${LAN}:8443)"
echo "App origin is taken from the browser Host header — no URL hardcoding."
