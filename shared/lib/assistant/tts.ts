import { MsEdgeTTS, OUTPUT_FORMAT, ProsodyOptions } from "msedge-tts"

/**
 * Edge online TTS currently exposes only Svetlana/Dmitry for ru-RU.
 * Emma Multilingual speaks Russian clearly and sounds different from Svetlana.
 */
const VOICE_RU = "en-US-EmmaMultilingualNeural"
const VOICE_RU_FALLBACK = "ru-RU-SvetlanaNeural"
const VOICE_EN = "en-US-AriaNeural"

let cachedRu: MsEdgeTTS | null = null
let cachedRuVoice: string | null = null
let cachedEn: MsEdgeTTS | null = null

function ruProsody(): ProsodyOptions {
  const p = new ProsodyOptions()
  // Slightly brighter / quicker — less “phone attendant” than stock Svetlana
  p.pitch = "+4%"
  p.rate = 1.06
  p.volume = "+0%"
  return p
}

async function getTts(lang: "ru" | "en", voiceOverride?: string): Promise<MsEdgeTTS> {
  if (lang === "en") {
    if (!cachedEn) {
      cachedEn = new MsEdgeTTS()
      await cachedEn.setMetadata(VOICE_EN, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    }
    return cachedEn
  }
  const voice = voiceOverride || VOICE_RU
  if (!cachedRu || cachedRuVoice !== voice) {
    cachedRu = new MsEdgeTTS()
    await cachedRu.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    cachedRuVoice = voice
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

async function synthesizeWithVoice(
  text: string,
  voice: string,
  withProsody: boolean,
): Promise<Buffer | null> {
  const tts = await getTts("ru", voice)
  const { audioStream } = withProsody
    ? tts.toStream(text, ruProsody())
    : tts.toStream(text)
  const buf = await streamToBuffer(audioStream)
  return buf.length ? buf : null
}

/** Synthesize MP3 via Microsoft Edge online TTS (no API key). */
export async function synthesizeSpeech(
  text: string,
  lang: "ru" | "en" = "ru",
): Promise<Buffer | null> {
  const trimmed = text.trim().slice(0, 360)
  if (!trimmed) return null
  try {
    if (lang === "en") {
      const tts = await getTts("en")
      const { audioStream } = tts.toStream(trimmed)
      const buf = await streamToBuffer(audioStream)
      return buf.length ? buf : null
    }
    try {
      return await synthesizeWithVoice(trimmed, VOICE_RU, true)
    } catch (e) {
      console.warn("Primary RU TTS failed, falling back to Svetlana:", e)
      cachedRu = null
      cachedRuVoice = null
      return await synthesizeWithVoice(trimmed, VOICE_RU_FALLBACK, true)
    }
  } catch (e) {
    console.error("TTS failed:", e)
    if (lang === "en") cachedEn = null
    else {
      cachedRu = null
      cachedRuVoice = null
    }
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
