import { NextResponse } from "next/server"
import { normalizeDbMode } from "@/shared/config/runtime"
import { probeDatabase } from "@/shared/lib/home/db-switch"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const mode = normalizeDbMode(String(body.mode || "local"))
    const result = await probeDatabase({
      mode,
      url: String(body.url || ""),
      anonKey: body.anonKey ? String(body.anonKey) : undefined,
      serviceRoleKey: String(body.serviceRoleKey || ""),
    })
    return NextResponse.json(result, { status: result.ok ? 200 : 422 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 })
  }
}
