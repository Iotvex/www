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
