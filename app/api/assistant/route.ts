import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const ASSISTANT =
  process.env.IOTVEX_ASSISTANT_URL || "http://127.0.0.1:8777"

/** Proxy text commands to the local Alexa voice-assistant service. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const res = await fetch(`${ASSISTANT}/v1/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    })
  } catch (e) {
    return NextResponse.json(
      {
        error: String(e),
        hint: "Start the assistant: cd assistant && bash scripts/run.sh",
      },
      { status: 502 },
    )
  }
}

export async function GET() {
  try {
    const res = await fetch(`${ASSISTANT}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({
      ok: res.ok,
      assistant: data,
      wake_word: "Alexa",
      url: ASSISTANT,
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: String(e),
      wake_word: "Alexa",
      url: ASSISTANT,
    })
  }
}
