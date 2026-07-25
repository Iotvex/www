import { NextResponse } from "next/server"
import { runAssistantText } from "@/shared/lib/assistant/pipeline"
import { assistantStatusProbe } from "@/shared/lib/assistant/home"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const EXTERNAL =
  process.env.IOTVEX_ASSISTANT_URL || "http://127.0.0.1:8777"

async function pythonHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${EXTERNAL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { status?: string }
    return data.status === "ok"
  } catch {
    return false
  }
}

/**
 * Voice assistant entrypoint for the website FAB / Assistant page.
 * Prefer the local Python Alexa (modular skills + Whisper) when online;
 * fall back to the Next.js NLU+TTS pipeline so the UI always works.
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

    // Prefer Python Alexa (skills: calendar, music, weather, search, …)
    if (await pythonHealthy()) {
      try {
        const res = await fetch(`${EXTERNAL}/v1/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, include_audio: includeAudio }),
          signal: AbortSignal.timeout(45_000),
        })
        if (res.ok) {
          const data = await res.json()
          return NextResponse.json({ ...data, source: "python" })
        }
      } catch {
        /* fall through to local */
      }
    }

    const result = await runAssistantText(text, { includeAudio })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}

export async function GET() {
  const probe = await assistantStatusProbe()
  let python: Record<string, unknown> | null = null
  try {
    const res = await fetch(`${EXTERNAL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) python = (await res.json()) as Record<string, unknown>
  } catch {
    python = null
  }
  return NextResponse.json({
    ok: true,
    wake_word: "Алекса",
    wake_words: ["Алекса", "Alexa"],
    local: true,
    tts: true,
    python,
    home: probe,
  })
}
