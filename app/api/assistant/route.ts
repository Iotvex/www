import { NextResponse } from "next/server"
import { runAssistantText } from "@/shared/lib/assistant/pipeline"
import { assistantStatusProbe } from "@/shared/lib/assistant/home"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const EXTERNAL =
  process.env.IOTVEX_ASSISTANT_URL || "http://127.0.0.1:8777"

/**
 * Voice assistant entrypoint for the website.
 * Runs NLU + home control locally and returns spoken MP3 (audio_b64).
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || ""

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
            hint: "Audio STT needs the Python assistant. Use text / browser speech for now.",
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

    const includeAudio = body?.include_audio !== false
    const result = await runAssistantText(text, { includeAudio })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}

export async function GET() {
  const probe = await assistantStatusProbe()
  return NextResponse.json({
    ok: true,
    wake_word: "Alexa",
    wake_words: ["Алекса", "Alexa", "Света", "Sveta"],
    local: true,
    tts: true,
    home: probe,
  })
}
