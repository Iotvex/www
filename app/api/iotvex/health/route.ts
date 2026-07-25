import { NextResponse } from "next/server"
import { agentFetch } from "@/shared/lib/agent-fetch"

export const dynamic = "force-dynamic"

/** Lightweight agent reachability — no Thread/UDP, no strip decode. */
export async function GET() {
  try {
    const res = await agentFetch("/health", {
      signal: AbortSignal.timeout(2000),
    })
    const text = await res.text()
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: text || `agent ${res.status}` },
        { status: 502 },
      )
    }
    let body: unknown = null
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text }
    }
    return NextResponse.json(
      { ok: true, agent: body },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    )
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    )
  }
}
