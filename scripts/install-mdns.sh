#!/usr/bin/env bash
# Advertise Iotvex www on LAN via Avahi (_http:_3100 / _https:_8443).
set -euo pipefail
NAME="${IOTVEX_MDNS_NAME:-iotvex.local}"
HOST_LABEL="${NAME%%.local}"
HOST_LABEL="${HOST_LABEL%%.*}"
[[ -n "$HOST_LABEL" ]] || HOST_LABEL=iotvex

if [[ "${EUID}" -ne 0 ]]; then
  echo "Need root. Re-run: sudo $0" >&2
  exit 1
fi

if ! command -v avahi-daemon >/dev/null 2>&1; then
  if command -v pacman >/dev/null 2>&1; then
    pacman -Sy --noconfirm avahi nss-mdns
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y avahi-daemon libnss-mdns
  else
    echo "Install avahi-daemon manually" >&2
    exit 1
  fi
fi

install -d /etc/avahi/services
cat > /etc/avahi/services/iotvex-www.service <<AVAHI
<?xml version="1.0" standalone='no'?><!--*-nxml-*-->
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">Iotvex WWW on %h</name>
  <service>
    <type>_http._tcp</type>
    <port>3100</port>
    <txt-record>path=/</txt-record>
    <txt-record>iotvex=www</txt-record>
  </service>
  <service>
    <type>_https._tcp</type>
    <port>8443</port>
    <txt-record>path=/</txt-record>
    <txt-record>iotvex=www</txt-record>
  </service>
</service-group>
AVAHI

systemctl enable --now avahi-daemon
systemctl restart avahi-daemon

LAN="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')"
echo "mDNS services published (_http/_https)."
echo "Open http://${LAN}:3100 or https://${LAN}:8443"
echo "If Avahi hostname is ${HOST_LABEL}: http://${HOST_LABEL}.local:3100"
