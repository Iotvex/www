import { NextResponse } from "next/server"
import { loadYandexStore } from "@/shared/lib/yandex-smart-home/config"

export const dynamic = "force-dynamic"

/** Public (non-secret) OAuth client id for Dialogs console setup. */
export async function GET() {
  const store = loadYandexStore()
  return NextResponse.json({
    client_id: store.clientId,
    authorize_path: "/oauth/authorize",
    token_path: "/oauth/token",
    endpoint_path: "/v1.0",
    note: "Client secret is in config/yandex-smart-home.json (host only).",
  })
}
