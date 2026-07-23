/** Client-safe helpers for capability-driven action UIs. */

export type ActionVerbOption = {
  value: string
  /** Message key under `actions.*` */
  labelKey:
    | "turn_on"
    | "turn_off"
    | "toggle"
    | "set_brightness"
    | "set_color"
    | "set_effect"
    | "set_speed"
  needs?: string[]
}

export function verbsForCapabilities(caps: string[], domain = "home"): ActionVerbOption[] {
  const out: ActionVerbOption[] = []
  if (caps.includes("on_off") || domain === "light" || domain === "switch" || domain === "fan" || domain === "lock") {
    out.push({ value: "turn_on", labelKey: "turn_on" })
    out.push({ value: "turn_off", labelKey: "turn_off" })
    out.push({ value: "toggle", labelKey: "toggle" })
  }
  if (caps.includes("brightness")) {
    out.push({ value: "set_brightness", labelKey: "set_brightness", needs: ["brightness"] })
  }
  if (caps.includes("color")) {
    out.push({ value: "set_color", labelKey: "set_color", needs: ["color"] })
  }
  if (caps.includes("effect")) {
    out.push({ value: "set_effect", labelKey: "set_effect", needs: ["effect"] })
  }
  if (caps.includes("speed")) {
    out.push({ value: "set_speed", labelKey: "set_speed", needs: ["speed"] })
  }
  if (!out.length) {
    out.push({ value: "turn_on", labelKey: "turn_on" })
    out.push({ value: "turn_off", labelKey: "turn_off" })
  }
  return out
}

export function defaultStripName(index: number): string {
  if (index === 0) return "Left Strip"
  if (index === 1) return "Right Strip"
  return `Strip ${index}`
}

export const DEFAULT_EFFECT_LIST = [
  "solid",
  "rainbow",
  "chase",
  "pulse",
  "sparkle",
  "theater",
  "fire",
  "comet",
  "wave",
  "scanner",
  "twinkle",
  "gradient",
  "color_loop",
  "snow",
]


/** Wire effect id → UI affordances (mirrors firmware StripSet render_effect). */
export type EffectAffordances = {
  color: boolean
  speed: boolean
}

const EFFECT_AFFORDANCES: EffectAffordances[] = [
  { color: true, speed: false }, // solid
  { color: false, speed: true }, // rainbow
  { color: true, speed: true }, // chase
  { color: true, speed: true }, // pulse
  { color: true, speed: true }, // sparkle
  { color: true, speed: true }, // theater
  { color: false, speed: true }, // fire
  { color: true, speed: true }, // comet
  { color: true, speed: true }, // wave
  { color: true, speed: true }, // scanner
  { color: true, speed: true }, // twinkle
  { color: true, speed: false }, // gradient
  { color: false, speed: true }, // color_loop
  { color: true, speed: true }, // snow
]

export function effectAffordances(effectId: number): EffectAffordances {
  const row = EFFECT_AFFORDANCES[Math.trunc(effectId)]
  return row ?? { color: true, speed: true }
}

export function effectSupportsColor(effectId: number): boolean {
  return effectAffordances(effectId).color
}

export function effectSupportsSpeed(effectId: number): boolean {
  return effectAffordances(effectId).speed
}

/** Map 1..100% UI ↔ 1..255 wire byte. */
export function pctToByte(pct: number): number {
  const p = Math.max(1, Math.min(100, Math.round(pct)))
  return Math.max(1, Math.min(255, Math.round((p / 100) * 255)))
}

export function byteToPct(byte: number): number {
  const b = Math.max(0, Math.min(255, Math.round(byte)))
  return Math.max(1, Math.min(100, Math.round((b / 255) * 100)))
}
