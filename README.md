# Iotvex WWW

Local-only smart-home control panel.

## Stack

- Next.js panel on LAN (`http://iotvex.local` / host IP)
- Local Supabase (Docker)
- OTBR Thread border router + `iotvex-agent`

No cloud publish, Cloudflare, Vercel, or voice assistant integration.

## Run

```bash
docker compose up -d --build
```

Automations tick via `iotvex-automations.timer` → `POST http://127.0.0.1/api/cron/automations`.

## Layout (FSD)

- `app/` — routes, providers
- `widgets/` — page compositions
- `features/` — user interactions
- `entities/` — business entities
- `shared/` — reusable ui / lib / config (multi-use only)
