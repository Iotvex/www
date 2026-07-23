import { NextResponse } from "next/server"
import { tickAutomations } from "@/shared/lib/home/runner"

export const dynamic = "force-dynamic"

/**
 * Home-only automation tick.
 * Called by local systemd (iotvex-automations.timer) against 127.0.0.1:3100.
 * Auth: x-cron-secret. Not a public webhook — do not expose via WAN cron.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET || ""
  const hdr = request.headers.get("x-cron-secret") || ""
  if (!secret || hdr !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  try {
    const result = await tickAutomations()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}

export async function GET(request: Request) {
  return POST(request)
}
