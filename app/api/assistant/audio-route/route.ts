import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const EXTERNAL =
  process.env.IOTVEX_ASSISTANT_URL?.trim() || "http://127.0.0.1:18927"

function assistantAuthHeaders(extra?: HeadersInit): Headers {
  const h = new Headers(extra)
  const token = (
    process.env.IOTVEX_ASSISTANT_TOKEN ||
    process.env.IOTVEX_SERVICE_TOKEN ||
    process.env.CRON_SECRET ||
    ""
  ).trim()
  if (token) {
    h.set("Authorization", `Bearer ${token}`)
    h.set("X-Iotvex-Token", token)
    h.set("X-Iotvex-Assistant-Token", token)
  }
  return h
}

/** Proxy RMS heartbeats to Python Alexa for multi-device mic arbitration. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const res = await fetch(`${EXTERNAL}/v1/audio-route/heartbeat`, {
      method: "POST",
      headers: assistantAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    })
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 })
  }
}

export async function GET() {
  try {
    const res = await fetch(`${EXTERNAL}/v1/audio-route`, {
      cache: "no-store",
      headers: assistantAuthHeaders(),
      signal: AbortSignal.timeout(2500),
    })
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 })
  }
}
