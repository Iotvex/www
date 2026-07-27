/** Wake words: Алекса / Alexa only (unicode-safe, no JS \\b).
 *
 * Command text is ALWAYS the substring AFTER the first wake token.
 * Pre-wake context is discarded (never treated as the command).
 */

export const WAKE_TOKEN = "алекс[аеуыой]?|alexa"

export const WAKE_RE = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])(${WAKE_TOKEN})(?=[^\\p{L}\\p{N}]|$)`,
  "iu",
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

function firstWakeMatch(text: string): RegExpExecArray | null {
  const padded = ` ${text} `
  const exact = new RegExp(WAKE_RE.source, "iu")
  const m1 = exact.exec(padded)
  if (m1) return m1
  const fuzzy = new RegExp(FUZZY_ALEXA.source, "iu")
  return fuzzy.exec(padded)
}

export function detectWakeName(text: string): WakeName {
  const padded = ` ${normalizeWakeText(text)} `
  if (WAKE_RE.test(padded) || FUZZY_ALEXA.test(padded)) return "alexa"
  return null
}

export function hasWakeWord(text: string): boolean {
  return detectWakeName(text) != null
}

/**
 * Keep ONLY words after the first wake token.
 * «…что такое Alexa пицца…» → cleaned «пицца»
 */
export function stripWakeWord(text: string): {
  cleaned: string
  hadWake: boolean
  wakeName: WakeName
} {
  const wakeName = detectWakeName(text)
  if (!wakeName) return { cleaned: text.trim(), hadWake: false, wakeName: null }

  const m = firstWakeMatch(text)
  if (!m || m.index == null) {
    return { cleaned: text.trim(), hadWake: true, wakeName }
  }
  // Match was against ` ${text} ` — index 0 is the leading space
  const endInPadded = m.index + m[0].length
  const endInText = Math.max(0, endInPadded - 1)
  let cleaned = text.slice(endInText).replace(/^[,.\s!:;\-—–]+/u, "").trim()
  cleaned = cleaned.replace(/\s+/g, " ")
  return { cleaned, hadWake: true, wakeName }
}

export function wakeDisplayName(wake: WakeName, lang: "ru" | "en" = "ru"): string {
  void wake
  return lang === "ru" ? "Алекса" : "Alexa"
}
