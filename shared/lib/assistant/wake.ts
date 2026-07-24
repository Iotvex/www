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

/** Looser ASR variants — common mishears / truncated forms.
 *  Do NOT match bare «свет» (means “light”) — only Света-like forms. */
const FUZZY_ALEXA =
  /(?:^|[^\p{L}\p{N}])(а+л+е+к+с+[аеуыой]?|алякс[аеуыой]?|олекс[аеуыой]?|алекс|alexa?|alexia)(?=[^\p{L}\p{N}]|$)/iu
const FUZZY_SVETA =
  /(?:^|[^\p{L}\p{N}])(св+е+т+(?:а|у|е|ой|ы|ою)|sveta)(?=[^\p{L}\p{N}]|$)/iu

export type WakeName = "alexa" | "sveta" | null

function collapseRepeats(s: string): string {
  return s.replace(/(.)\1{2,}/gu, "$1$1")
}

function normalizeWakeText(text: string): string {
  return collapseRepeats(text.toLowerCase().replace(/ё/g, "е").replace(/[’'`]/g, ""))
}

export function detectWakeName(text: string): WakeName {
  const padded = ` ${normalizeWakeText(text)} `
  const m = padded.match(WAKE_RE)
  if (m) {
    const w = m[1].toLowerCase().replace(/ё/g, "е")
    if (w.startsWith("свет") || w === "sveta") return "sveta"
    return "alexa"
  }
  if (FUZZY_SVETA.test(padded)) return "sveta"
  if (FUZZY_ALEXA.test(padded)) return "alexa"
  return null
}

export function hasWakeWord(text: string): boolean {
  return detectWakeName(text) != null
}

export function stripWakeWord(text: string): {
  cleaned: string
  hadWake: boolean
  wakeName: WakeName
} {
  const wakeName = detectWakeName(text)
  if (!wakeName) return { cleaned: text.trim(), hadWake: false, wakeName: null }
  const cleaned = text
    .replace(new RegExp(WAKE_RE_GLOBAL.source, "giu"), " ")
    .replace(new RegExp(FUZZY_ALEXA.source, "giu"), " ")
    .replace(new RegExp(FUZZY_SVETA.source, "giu"), " ")
    .replace(/^[,\s.!:;\-—]+/, "")
    .replace(/\s+/g, " ")
    .trim()
  return { cleaned, hadWake: true, wakeName }
}

export function wakeDisplayName(wake: WakeName, lang: "ru" | "en" = "ru"): string {
  if (wake === "sveta") return lang === "ru" ? "Света" : "Sveta"
  return lang === "ru" ? "Алекса" : "Alexa"
}
