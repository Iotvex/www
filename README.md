# Iotvex WWW

Next.js dashboard for the DIY home hub.

## Modes

**Full matrix:** every WWW mode × every DB mode is supported.
`cloud` WWW + `local` DB automatically requires home bridges (tunneled Supabase + agent) via `scripts/publish-manager.sh` / `iotvex-publish.timer`.

### WWW (`IOTVEX_WWW_MODE` / Settings → Services)

| Mode | Meaning |
|------|---------|
| **local** | Self-hosted UI. Always: `http(s)://<ip>:<port>` + mDNS (`iotvex.local`, editable). |
| **local_published** | Same as local **plus** public HTTPS (port-forward, custom domain, Pinggy, Cloudflare Tunnel, ngrok, Tailscale Funnel…). |
| **cloud** | UI hosted in Iotvex cloud; home machine keeps agent/OTBR. |

### Database (`IOTVEX_DB_MODE` / Settings)

| Mode | Meaning |
|------|---------|
| **local** | Bundled Supabase on the home machine |
| **cloud_public** | Shared Iotvex-hosted Supabase |
| **cloud_private** | Your own Supabase project |

**Hot switch:** Settings → probe target → merge catalog (upsert) into target → swap active connection (`config/runtime.json` + `runtime.secrets.json`). No image rebuild. Browser reloads to pick up new inject.

Automations: config in DB; **ticks only on home** (`systemd` → `127.0.0.1:3100/api/cron/automations` → local agent).

## Config files

```
config/runtime.json           # www/db modes, mDNS, publish providers (mounted into container)
config/runtime.secrets.json   # service role / tunnel tokens (chmod 600, gitignored)
config/runtime.secrets.json.example
```

`GET/PATCH /api/runtime`  
`POST /api/runtime/db/probe`  
`POST /api/runtime/db/switch`

## Run

```bash
./scripts/up.sh
INSTALL_MDNS=1 ./scripts/up.sh
INSTALL_HTTPS=1 IOTVEX_WWW_MODE=local_published ./scripts/up.sh
```

Remote private DB helper:

```bash
./scripts/use-remote-supabase.sh https://xxxx.supabase.co ANON SERVICE_ROLE local_published
```


## Publish / bridges (home host)

```bash
./scripts/publish-manager.sh reconcile   # or stop-all / status
# systemd: iotvex-publish.timer + iotvex-publish.path
```

| WWW \ DB | local | cloud_public | cloud_private |
|----------|-------|--------------|---------------|
| local | LAN/mDNS | LAN/mDNS + remote DB | LAN/mDNS + remote DB |
| local_published | + public WWW | + public WWW | + public WWW |
| cloud | tunnel **DB+agent** | tunnel **agent** | tunnel **agent** |

After bridges are up, see `config/cloud-client.env` for env vars a cloud WWW deploy should use (especially `cloud` × `local`).
