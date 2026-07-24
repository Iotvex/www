import { executeAssistantIntent, assistantStatusProbe } from "./home"
import {
  formatAssistantReply,
  parseAssistantText,
  type ParsedIntent,
} from "./nlu"

export type AssistantPipelineResult = {
  reply: string
  intent: string
  confidence: number
  lang: string
  entities: Record<string, unknown>
  actions: Array<Record<string, unknown>>
  had_wake: boolean
  source: "local"
  error?: string
}

export async function runAssistantText(text: string): Promise<AssistantPipelineResult> {
  const parsed: ParsedIntent = parseAssistantText(text)
  const exec = await executeAssistantIntent(parsed)

  if (parsed.name === "status") {
    const probe = await assistantStatusProbe()
    const reply =
      parsed.lang === "ru"
        ? probe.agent
          ? `Система на связи. Лент онлайн: ${probe.strips}.`
          : "Агент умного дома сейчас не отвечает."
        : probe.agent
          ? `Online. Strips: ${probe.strips}.`
          : "Smart home agent is unreachable."
    return {
      reply,
      intent: parsed.name,
      confidence: parsed.confidence,
      lang: parsed.lang,
      entities: parsed.entities as Record<string, unknown>,
      actions: [],
      had_wake: parsed.hadWake,
      source: "local",
    }
  }

  const reply = formatAssistantReply(
    parsed.name,
    parsed.entities,
    parsed.lang,
    exec.ok || parsed.name === "unknown" || parsed.name === "help" || parsed.name === "greeting",
    exec.detail,
  )

  return {
    reply,
    intent: parsed.name,
    confidence: parsed.confidence,
    lang: parsed.lang,
    entities: parsed.entities as Record<string, unknown>,
    actions: exec.actions as unknown as Array<Record<string, unknown>>,
    had_wake: parsed.hadWake,
    source: "local",
    error: exec.ok ? undefined : exec.detail,
  }
}

export { parseAssistantText }
