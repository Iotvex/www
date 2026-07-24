/** Wake words: Алекса / Alexa and Света / Sveta (unicode-safe, no JS \\b). */

export const WAKE_TOKEN =
  "алекс[аеуыой]?|alexa|свет(?:а|у|е|ой|ы|ою)|sveta"

export const WAKE_RE = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])(${WAKE_TOKEN})(?=[^\\p{L}\\p{N}]|$)`,
  "iu",
)

export const WAKE_RE_GLOBAL = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])(${WAKE_TOKEN})(?=[^\\p{L}\\p{N}]|$)`,
  "giu",
)

export type WakeName = "alexa" | "sveta" | null

export function detectWakeName(text: string): WakeName {
  const m = ` ${text} `.match(WAKE_RE)
  if (!m) return null
  const w = m[1].toLowerCase().replace(/ё/g, "е")
  if (w.startsWith("свет") || w === "sveta") return "sveta"
  return "alexa"
}

export function hasWakeWord(text: string): boolean {
  return WAKE_RE.test(` ${text} `)
}

export function stripWakeWord(text: string): {
  cleaned: string
  hadWake: boolean
  wakeName: WakeName
} {
  const wakeName = detectWakeName(text)
  if (!wakeName) return { cleaned: text.trim(), hadWake: false, wakeName: null }
  const cleaned = text
    .replace(WAKE_RE_GLOBAL, " ")
    .replace(/^[,\s.!:;\-—]+/, "")
    .replace(/\s+/g, " ")
    .trim()
  return { cleaned, hadWake: true, wakeName }
}

export function wakeDisplayName(wake: WakeName, lang: "ru" | "en" = "ru"): string {
  if (wake === "sveta") return lang === "ru" ? "Света" : "Sveta"
  return lang === "ru" ? "Алекса" : "Alexa"
}
