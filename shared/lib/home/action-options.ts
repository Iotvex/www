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

/** Caps that mean the entity can be commanded (not a read-only sensor). */
export const CONTROLLABLE_CAPS = [
  "on_off",
  "brightness",
  "color",
  "effect",
  "speed",
] as const

const CONTROLLABLE_DOMAINS = new Set([
  "light",
  "switch",
  "fan",
  "lock",
  "climate",
  "cover",
  "media_player",
])

const OBSERVABLE_DOMAINS = new Set([
  "sensor",
  "binary_sensor",
  "weather",
  "person",
])

type CapEntityLike = {
  id?: string
  entity_id?: string
  domain?: string
  capabilities?: readonly string[]
}

function domainOf(entity: CapEntityLike): string {
  return entity.domain || String(entity.entity_id || entity.id || "").split(".")[0] || ""
}

/** True when the entity accepts commands (turn on, brightness, …). Sensors are never controllable. */
export function isControllableEntity(entity: CapEntityLike): boolean {
  const domain = domainOf(entity)
  if (OBSERVABLE_DOMAINS.has(domain)) return false
  const caps = entity.capabilities || []
  if (caps.some((c) => (CONTROLLABLE_CAPS as readonly string[]).includes(c))) return true
  return CONTROLLABLE_DOMAINS.has(domain)
}

/** Entities usable in triggers/conditions (state / numeric / binary readings). */
export function isObservableEntity(entity: CapEntityLike): boolean {
  const domain = domainOf(entity)
  if (OBSERVABLE_DOMAINS.has(domain)) return true
  const caps = entity.capabilities || []
  if (caps.includes("value") || caps.includes("binary") || caps.includes("temperature") || caps.includes("humidity")) {
    return true
  }
  // Controllable devices can still appear in state conditions (e.g. light is on).
  return isControllableEntity(entity)
}

/** Intersection of capability lists across selected targets. */
export function sharedCapabilities(entities: CapEntityLike[]): string[] {
  if (!entities.length) return []
  let shared: Set<string> | null = null
  for (const entity of entities) {
    const caps = new Set(
      (entity.capabilities?.length
        ? entity.capabilities
        : CONTROLLABLE_DOMAINS.has(domainOf(entity))
          ? domainOf(entity) === "light"
            ? ["on_off", "brightness", "color", "effect", "speed"]
            : ["on_off"]
          : []) as string[],
    )
    shared = shared == null ? caps : new Set([...shared].filter((c) => caps.has(c)))
  }
  return shared ? [...shared] : []
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
