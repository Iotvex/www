/** Wake words: Алекса / Alexa only (unicode-safe, no JS \\b). */

export const WAKE_TOKEN = "алекс[аеуыой]?|alexa"

export const WAKE_RE = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])(${WAKE_TOKEN})(?=[^\\p{L}\\p{N}]|$)`,
  "iu",
)

export const WAKE_RE_GLOBAL = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])(${WAKE_TOKEN})(?=[^\\p{L}\\p{N}]|$)`,
  "giu",
)

/** Looser ASR variants — common mishears / truncated forms. */
const FUZZY_ALEXA =
  /(?:^|[^\p{L}\p{N}])(а+л+е+к+с+[аеуыой]?|алякс[аеуыой]?|олекс[аеуыой]?|алекс|alexa?|alexia)(?=[^\p{L}\p{N}]|$)/iu

export type WakeName = "alexa" | null

function collapseRepeats(s: string): string {
  return s.replace(/(.)\1{2,}/gu, "$1$1")
}

function normalizeWakeText(text: string): string {
  return collapseRepeats(text.toLowerCase().replace(/ё/g, "е").replace(/[’'`]/g, ""))
}

export function detectWakeName(text: string): WakeName {
  const padded = ` ${normalizeWakeText(text)} `
  const m = padded.match(WAKE_RE)
  if (m) return "alexa"
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
    .replace(/^[,\s.!:;\-—]+/, "")
    .replace(/\s+/g, " ")
    .trim()
  return { cleaned, hadWake: true, wakeName }
}

export function wakeDisplayName(wake: WakeName, lang: "ru" | "en" = "ru"): string {
  void wake
  return lang === "ru" ? "Алекса" : "Alexa"
}
