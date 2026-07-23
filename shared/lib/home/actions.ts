import { createAdminClient } from "@/shared/lib/supabase/admin"
import {
  MSG,
  packSetStripPayload,
  pickLightOpaqueNode,
  type AgentOpaqueNode,
  type ProtoStrip,
} from "@/shared/lib/iotvex-proto"

const AGENT = process.env.IOTVEX_AGENT_URL || "http://127.0.0.1:7421"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function asEntityIds(
  target: Record<string, unknown> | undefined,
  fallback?: unknown,
): string[] {
  const raw = target?.entity_id ?? fallback
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((v) => String(v || "").trim()).filter(Boolean))]
  }
  const one = String(raw || "").trim()
  return one ? [one] : []
}

function asEntityId(target: Record<string, unknown> | undefined): string {
  return asEntityIds(target)[0] || ""
}

const EFFECT_NAME_TO_ID: Record<string, number> = {
  solid: 0,
  rainbow: 1,
  chase: 2,
  pulse: 3,
  sparkle: 4,
  theater: 5,
  fire: 6,
  comet: 7,
  wave: 8,
  scanner: 9,
  twinkle: 10,
  gradient: 11,
  color_loop: 12,
  snow: 13,
}

/** Accept wire id or effect name string from older automations. */
function resolveEffectId(value: unknown): number | undefined {
  if (value == null) return undefined
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  const raw = String(value).trim()
  if (!raw) return undefined
  const asNum = Number(raw)
  if (Number.isFinite(asNum)) return Math.trunc(asNum)
  const named = EFFECT_NAME_TO_ID[raw.toLowerCase()]
  return named != null ? named : undefined
}

/** Normalize HA-style or short verbs into a domain-agnostic verb. */
export function normalizeVerb(action: Record<string, unknown>, domain = "home"): string {
  const raw = String(action.action || action.service || action.type || "").trim()
  if (!raw) return ""
  if (raw.includes(".")) {
    const [, verb] = raw.split(".", 2)
    return verb || raw
  }
  // domain.turn_on already handled; accept bare verbs
  void domain
  return raw
}

function serviceName(domain: string, verb: string) {
  return `${domain}.${verb}`
}

type EntityRow = {
  id: string
  domain: string
  capabilities: string[]
  attributes: Record<string, unknown>
  device_id: string | null
}

async function loadEntity(entityId: string): Promise<EntityRow | null> {
  const sb = createAdminClient()
  const { data } = await sb.from("entities").select("*").eq("id", entityId).maybeSingle()
  return (data as EntityRow | null) || null
}

async function loadState(entityId: string) {
  const sb = createAdminClient()
  const { data } = await sb.from("entity_states").select("*").eq("entity_id", entityId).maybeSingle()
  return data as { state: string; attributes: Record<string, unknown> } | null
}

async function controlIotvexStrip(
  index: number,
  verb: string,
  data: Record<string, unknown>,
  currentOn?: boolean,
  preferredNodeId?: number,
  current?: {
    brightness?: number
    r?: number
    g?: number
    b?: number
    effect?: number
    speed?: number
  },
) {
  const body: Record<string, unknown> = {}

  if (verb === "toggle") {
    body.on = !(currentOn ?? false)
  } else if (verb === "turn_off") {
    body.on = false
  } else if (verb === "turn_on" || verb === "set_brightness" || verb === "set_color" || verb === "set_effect" || verb === "set_speed") {
    body.on = true
  } else if (data.state === "off") {
    body.on = false
  } else if (data.state === "on" || verb) {
    body.on = true
  }

  if (typeof data.brightness_pct === "number") {
    body.brightness = Math.round((Number(data.brightness_pct) / 100) * 255)
  }
  if (typeof data.brightness === "number") body.brightness = Number(data.brightness)

  if (Array.isArray(data.rgb_color) && data.rgb_color.length >= 3) {
    body.r = Number(data.rgb_color[0])
    body.g = Number(data.rgb_color[1])
    body.b = Number(data.rgb_color[2])
  }
  if (typeof data.r === "number") body.r = data.r
  if (typeof data.g === "number") body.g = data.g
  if (typeof data.b === "number") body.b = data.b

  const effectId = resolveEffectId(data.effect ?? data.effect_id)
  if (effectId != null) body.effect = effectId
  if (typeof data.speed === "number") body.speed = Number(data.speed)

  const strip: ProtoStrip = {
    index,
    on: Boolean(body.on ?? true),
    brightness: Number(body.brightness ?? current?.brightness ?? 255),
    r: Number(body.r ?? current?.r ?? 255),
    g: Number(body.g ?? current?.g ?? 255),
    b: Number(body.b ?? current?.b ?? 255),
    effect: Number(body.effect ?? current?.effect ?? 0),
    speed: Number(body.speed ?? current?.speed ?? 128),
  }

  // Prefer known node_id — skip slow /nodes round-trip when possible.
  let nodeId =
    preferredNodeId != null && Number.isFinite(preferredNodeId) && preferredNodeId > 0
      ? Number(preferredNodeId)
      : null

  if (nodeId == null) {
    try {
      const listRes = await fetch(`${AGENT}/nodes`, {
        cache: "no-store",
        signal: AbortSignal.timeout(1500),
      })
      if (!listRes.ok) {
        return { ok: false, status: listRes.status, platform: "iotvex", index, body: strip }
      }
      const listBody = (await listRes.json()) as { nodes?: AgentOpaqueNode[] }
      const light = pickLightOpaqueNode(listBody.nodes || [])
      if (!light) {
        return { ok: false, status: 503, platform: "iotvex", index, body: strip, error: "no light node" }
      }
      nodeId = Number(light.node_id)
    } catch (e) {
      return { ok: false, status: 502, platform: "iotvex", index, body: strip, error: String(e) }
    }
  }

  const res = await fetch(`${AGENT}/node/${nodeId}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(2500),
    body: JSON.stringify({
      msg_type: MSG.SET_STRIP,
      payload_b64: packSetStripPayload(strip),
      need_ack: false,
    }),
  })
  return { ok: res.ok, status: res.status, platform: "iotvex", index, body: strip, node_id: nodeId }
}

/**
 * Abstract action runner: resolves entity + capabilities/platform,
 * then dispatches to the right backend (iotvex agent today, modules later).
 */
export async function runHomeAction(action: Record<string, unknown>): Promise<Record<string, unknown>> {
  const kind = String(action.action || action.service || action.type || "")

  // Meta steps
  if (kind === "delay" || action.delay != null) {
    const ms = Number(action.delay_ms ?? action.delay ?? 0)
    if (ms > 0) await sleep(Math.min(ms, 60_000))
    return { ok: true, delayed: ms }
  }

  if (kind === "scene.turn_on" || kind === "scene.activate") {
    const sceneId = String(action.scene_id || asEntityId(action.target as Record<string, unknown>) || "")
    if (!sceneId) return { ok: false, reason: "scene_id required" }
    const { getScene } = await import("@/shared/lib/home/catalog")
    const scene = await getScene(sceneId)
    const results = []
    for (const [entityId, desired] of Object.entries(scene.entities || {})) {
      const d = (desired || {}) as Record<string, unknown>
      results.push(
        await runHomeAction({
          action: d.state === "off" ? "home.turn_off" : "home.turn_on",
          target: { entity_id: entityId },
          data: d,
        }),
      )
    }
    return { ok: true, scene_id: sceneId, results }
  }

  if (kind === "script.turn_on" || kind === "script.run") {
    const scriptId = String(action.script_id || asEntityId(action.target as Record<string, unknown>) || "")
    if (!scriptId) return { ok: false, reason: "script_id required" }
    const { getScript, touchScript } = await import("@/shared/lib/home/catalog")
    const script = await getScript(scriptId)
    const results = await runHomeActions(script.sequence || [])
    await touchScript(scriptId)
    return { ok: true, script_id: scriptId, results }
  }

  const target = (action.target || {}) as Record<string, unknown>
  const entityIds = asEntityIds(target, action.entity_id)
  if (!entityIds.length) return { ok: false, skipped: true, reason: "no entity_id" }

  // One action → many targets (same payload), not N duplicate automation rows.
  if (entityIds.length > 1) {
    const results = await Promise.all(
      entityIds.map((id) =>
        runHomeAction({
          ...action,
          entity_id: id,
          target: { entity_id: id },
        }),
      ),
    )
    return {
      ok: results.every((r) => Boolean((r as { ok?: boolean }).ok)),
      multi: true,
      entity_ids: entityIds,
      results,
    }
  }

  const entityId = entityIds[0]
  const entity = await loadEntity(entityId)
  const state = await loadState(entityId)
  const domain = entity?.domain || entityId.split(".")[0] || "home"
  const verb = normalizeVerb(action, domain) || "turn_on"
  const data = {
    ...((action.data || {}) as Record<string, unknown>),
  }
  // Allow flat fields on action for convenience
  for (const key of ["brightness", "brightness_pct", "rgb_color", "effect", "effect_id", "speed", "r", "g", "b", "state"]) {
    if (action[key] != null && data[key] == null) data[key] = action[key]
  }

  const attrs = {
    ...(entity?.attributes || {}),
    ...(state?.attributes || {}),
  }
  const platform = String(attrs.platform || "generic")
  const caps = new Set(entity?.capabilities || [])

  // Capability gate (soft): unknown caps still attempt if platform knows how
  const needsOnOff = ["turn_on", "turn_off", "toggle"].includes(verb)
  if (needsOnOff && caps.size && !caps.has("on_off") && domain !== "light" && domain !== "switch") {
    // still try — modules may declare loosely
  }

  if (platform === "iotvex" || Number.isFinite(Number(attrs.strip_index))) {
    const index = Number(attrs.strip_index)
    if (!Number.isFinite(index)) {
      return { ok: false, skipped: true, reason: "iotvex entity missing strip_index", entityId }
    }
    const currentOn = state?.state === "on"
    const preferredNodeId = Number(attrs.node_id)
    const rgb = (attrs.rgb_color as number[] | undefined) || []
    const curBri = Number(attrs.brightness)
    const curR = Number(rgb[0])
    const curG = Number(rgb[1])
    const curB = Number(rgb[2])
    const curEffect = resolveEffectId(attrs.effect)
    const curSpeed = Number(attrs.speed)
    return {
      ...(await controlIotvexStrip(
        index,
        verb,
        data,
        currentOn,
        Number.isFinite(preferredNodeId) ? preferredNodeId : undefined,
        {
          brightness: Number.isFinite(curBri) ? curBri : undefined,
          r: Number.isFinite(curR) ? curR : undefined,
          g: Number.isFinite(curG) ? curG : undefined,
          b: Number.isFinite(curB) ? curB : undefined,
          effect: curEffect,
          speed: Number.isFinite(curSpeed) ? curSpeed : undefined,
        },
      )),
      entityId,
      service: serviceName(domain, verb),
    }
  }

  // Future modules: POST to agent generic entity endpoint if available
  try {
    const res = await fetch(`${AGENT}/entities/${encodeURIComponent(entityId)}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: serviceName(domain, verb), data }),
    })
    if (res.status !== 404) {
      const text = await res.text()
      return { ok: res.ok, status: res.status, entityId, service: serviceName(domain, verb), body: text.slice(0, 200) }
    }
  } catch {
    /* agent may not expose generic endpoint yet */
  }

  return {
    ok: false,
    skipped: true,
    reason: `no handler for platform=${platform} ${serviceName(domain, verb)}`,
    entityId,
  }
}

export async function runHomeActions(actions: unknown[]) {
  // Parallel when steps are independent (no delay meta between them).
  const steps = (actions || []).map((step) => (step || {}) as Record<string, unknown>)
  const hasDelay = steps.some((s) => {
    const kind = String(s.action || s.service || s.type || "")
    return kind === "delay" || s.delay != null
  })
  if (hasDelay || steps.length <= 1) {
    const results = []
    for (const step of steps) results.push(await runHomeAction(step))
    return results
  }
  return Promise.all(steps.map((step) => runHomeAction(step)))
}
