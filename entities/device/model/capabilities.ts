import type { DeviceDomain, EntityCapability, EntityState } from "./types"

/** Infer capabilities from domain + attributes (no hardcoded device UI). */
export function inferCapabilities(
  domain: DeviceDomain,
  attributes: Record<string, unknown> = {},
): EntityCapability[] {
  const caps = new Set<EntityCapability>()

  if (domain === "light") {
    caps.add("on_off")
    const modes = attributes.supported_color_modes
    if (Array.isArray(modes)) {
      if (modes.includes("brightness") || modes.includes("rgb") || modes.includes("hs")) {
        caps.add("brightness")
      }
      if (modes.includes("rgb") || modes.includes("rgbw") || modes.includes("hs") || modes.includes("xy")) {
        caps.add("color")
      }
    } else {
      // default light: assume brightness+color if rgb present or strip light
      if (attributes.brightness != null || attributes.strip_index != null) caps.add("brightness")
      if (attributes.rgb_color != null || attributes.strip_index != null) caps.add("color")
    }
    if (attributes.effect != null || attributes.effect_list != null) caps.add("effect")
    if (attributes.speed != null || attributes.effect_list != null || attributes.strip_index != null) {
      caps.add("speed")
    }
    // strip lights always expose effect/speed when platform says so
    if (attributes.strip_index != null) {
      caps.add("effect")
      caps.add("speed")
    }
  }

  if (domain === "switch" || domain === "fan" || domain === "lock") {
    caps.add("on_off")
  }

  if (domain === "binary_sensor") caps.add("binary")

  if (domain === "sensor" || domain === "weather") {
    caps.add("value")
    const unit = String(attributes.unit_of_measurement || attributes.unit || "")
    if (/°|C|F|temp/i.test(unit) || /temp/i.test(String(attributes.device_class || ""))) {
      caps.add("temperature")
    }
    if (/%/.test(unit) || /humid/i.test(String(attributes.device_class || ""))) {
      caps.add("humidity")
    }
  }

  if (domain === "climate") {
    caps.add("on_off")
    caps.add("temperature")
  }

  if (caps.size === 0) caps.add("value")
  return [...caps]
}

export function hasCapability(entity: EntityState, cap: EntityCapability) {
  return entity.capabilities.includes(cap)
}

const INACTIVE_STATES = new Set(["", "unknown", "unavailable", "none", "null", "undefined"])

type ActiveEntityLike = {
  domain?: string
  state?: string
  available?: boolean
  capabilities?: readonly string[]
}

/**
 * System-status “active” metric:
 * - on_off / binary / lights: on | home | open
 * - sensors / weather / value: available + valid live reading (not Power-based)
 */
export function isEntityActive(entity: ActiveEntityLike): boolean {
  if (entity.available === false) return false

  const caps = entity.capabilities || []
  const has = (cap: string) => caps.includes(cap)
  const domain = entity.domain || ""

  const onOffLike =
    has("on_off") ||
    has("binary") ||
    domain === "light" ||
    domain === "switch" ||
    domain === "fan" ||
    domain === "lock" ||
    domain === "climate"

  if (onOffLike) {
    return entity.state === "on" || entity.state === "home" || entity.state === "open"
  }

  const raw = String(entity.state ?? "").trim()
  if (INACTIVE_STATES.has(raw.toLowerCase())) return false

  if (
    domain === "sensor" ||
    domain === "weather" ||
    domain === "binary_sensor" ||
    has("value") ||
    has("temperature") ||
    has("humidity") ||
    // Domain inferred from entity_id when overview uses a loose shape
    (!domain && raw.length > 0 && Number.isFinite(Number(raw)))
  ) {
    const n = Number(raw)
    if (Number.isFinite(n)) return true
    return raw.length > 0
  }

  return raw.length > 0
}

export function domainFromEntityId(entityId: string): DeviceDomain {
  const d = entityId.split(".")[0] || "other"
  const allowed: DeviceDomain[] = [
    "light", "switch", "sensor", "binary_sensor", "climate", "media_player",
    "cover", "fan", "lock", "camera", "automation", "scene", "script", "person", "weather", "other",
  ]
  return (allowed.includes(d as DeviceDomain) ? d : "other") as DeviceDomain
}
