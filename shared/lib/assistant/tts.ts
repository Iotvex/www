import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts"

const VOICE_RU = "ru-RU-SvetlanaNeural"
const VOICE_EN = "en-US-JennyNeural"

let cachedRu: MsEdgeTTS | null = null
let cachedEn: MsEdgeTTS | null = null

async function getTts(lang: "ru" | "en"): Promise<MsEdgeTTS> {
  if (lang === "en") {
    if (!cachedEn) {
      cachedEn = new MsEdgeTTS()
      await cachedEn.setMetadata(VOICE_EN, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    }
    return cachedEn
  }
  if (!cachedRu) {
    cachedRu = new MsEdgeTTS()
    await cachedRu.setMetadata(VOICE_RU, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
  }
  return cachedRu
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on("data", (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    stream.on("end", () => resolve(Buffer.concat(chunks)))
    stream.on("error", reject)
  })
}

/** Synthesize MP3 via Microsoft Edge online TTS (no API key). ~1s typical. */
export async function synthesizeSpeech(
  text: string,
  lang: "ru" | "en" = "ru",
): Promise<Buffer | null> {
  const trimmed = text.trim().slice(0, 360)
  if (!trimmed) return null
  try {
    const tts = await getTts(lang)
    const { audioStream } = tts.toStream(trimmed)
    const buf = await streamToBuffer(audioStream)
    return buf.length ? buf : null
  } catch (e) {
    console.error("TTS failed:", e)
    // Reset cache on failure (stale websocket)
    if (lang === "en") cachedEn = null
    else cachedRu = null
    return null
  }
}

export async function synthesizeSpeechBase64(
  text: string,
  lang: "ru" | "en" = "ru",
): Promise<string | null> {
  const buf = await synthesizeSpeech(text, lang)
  return buf ? buf.toString("base64") : null
}
