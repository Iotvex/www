import { NextResponse } from "next/server"
import { runAssistantText } from "@/shared/lib/assistant/pipeline"
import { assistantStatusProbe } from "@/shared/lib/assistant/home"

export const dynamic = "force-dynamic"

const EXTERNAL =
  process.env.IOTVEX_ASSISTANT_URL || "http://127.0.0.1:8777"

/**
 * Voice assistant entrypoint for the website.
 * Prefer the local Next.js pipeline (works on Vercel).
 * If IOTVEX_ASSISTANT_EXTERNAL=1, optionally forward to the Python service.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || ""

    // Audio upload → Python STT service when available
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData()
      const audio = form.get("audio")
      if (!(audio instanceof Blob)) {
        return NextResponse.json({ error: "audio field required" }, { status: 400 })
      }
      try {
        const upstream = new FormData()
        upstream.append("audio", audio, "speech.webm")
        const include = form.get("include_audio")
        if (include != null) upstream.append("include_audio", String(include))
        const res = await fetch(`${EXTERNAL}/v1/audio`, {
          method: "POST",
          body: upstream,
          signal: AbortSignal.timeout(60_000),
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
            hint: "Audio STT needs the Python assistant (Whisper/Vosk). Use text + browser speech for now.",
          },
          { status: 502 },
        )
      }
    }

    const body = (await request.json().catch(() => null)) as {
      text?: string
      include_audio?: boolean
    } | null
    const text = String(body?.text || "").trim()
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 })
    }

    // Local flexible NLU + home control (website parity)
    const result = await runAssistantText(text)
    return NextResponse.json({
      ...result,
      audio_b64: null,
      // Browser speaks via Web Speech Synthesis
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}

export async function GET() {
  const probe = await assistantStatusProbe()
  let external: Record<string, unknown> | null = null
  try {
    const res = await fetch(`${EXTERNAL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    })
    if (res.ok) external = (await res.json()) as Record<string, unknown>
  } catch {
    external = null
  }

  return NextResponse.json({
    ok: true,
    wake_word: "Alexa",
    local: true,
    home: probe,
    external: external
      ? { ok: true, url: EXTERNAL, ...external }
      : { ok: false, url: EXTERNAL },
  })
}
