import { executeAssistantIntent, assistantStatusProbe } from "./home"
import {
  formatAssistantReply,
  parseAssistantText,
  type ParsedIntent,
} from "./nlu"
import { synthesizeSpeechBase64 } from "./tts"

export type AssistantPipelineResult = {
  reply: string
  intent: string
  confidence: number
  lang: string
  entities: Record<string, unknown>
  actions: Array<Record<string, unknown>>
  had_wake: boolean
  wake_name?: string | null
  source: "local"
  audio_b64?: string | null
  error?: string
}

export async function runAssistantText(
  text: string,
  opts?: { includeAudio?: boolean },
): Promise<AssistantPipelineResult> {
  const includeAudio = opts?.includeAudio !== false
  const parsed: ParsedIntent = parseAssistantText(text)
  const exec = await executeAssistantIntent(parsed)

  let reply: string
  if (parsed.name === "status") {
    const probe = await assistantStatusProbe()
    reply =
      parsed.lang === "ru"
        ? probe.agent
          ? `Система на связи. Лент онлайн: ${probe.strips}.`
          : "Агент умного дома сейчас не отвечает."
        : probe.agent
          ? `Online. Strips: ${probe.strips}.`
          : "Smart home agent is unreachable."
  } else {
    reply = formatAssistantReply(
      parsed.name,
      parsed.entities,
      parsed.lang,
      exec.ok || parsed.name === "unknown" || parsed.name === "help" || parsed.name === "greeting",
      exec.detail,
      parsed.wakeName,
    )
  }

  let audio_b64: string | null = null
  if (includeAudio && reply) {
    audio_b64 = await synthesizeSpeechBase64(reply, parsed.lang)
  }

  return {
    reply,
    intent: parsed.name,
    confidence: parsed.confidence,
    lang: parsed.lang,
    entities: parsed.entities as Record<string, unknown>,
    actions: exec.actions as unknown as Array<Record<string, unknown>>,
    had_wake: parsed.hadWake,
    wake_name: parsed.wakeName,
    source: "local",
    audio_b64,
    error: exec.ok || parsed.name === "unknown" || parsed.name === "help" || parsed.name === "greeting"
      ? undefined
      : exec.detail,
  }
}

export { parseAssistantText }
