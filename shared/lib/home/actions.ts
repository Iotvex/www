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

function asEntityId(target: Record<string, unknown> | undefined): string {
  if (!target) return ""
  const raw = target.entity_id
  if (Array.isArray(raw)) return String(raw[0] || "")
  return String(raw || "")
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

  if (data.effect != null) body.effect = Number(data.effect)
  if (data.effect_id != null) body.effect = Number(data.effect_id)
  if (typeof data.speed === "number") body.speed = Number(data.speed)

  const strip: ProtoStrip = {
    index,
    on: Boolean(body.on ?? true),
    brightness: Number(body.brightness ?? 255),
    r: Number(body.r ?? 255),
    g: Number(body.g ?? 255),
    b: Number(body.b ?? 255),
    effect: Number(body.effect ?? 0),
    speed: Number(body.speed ?? 128),
  }

  // Agent is opaque pipe — pack SET_STRIP here, never /node/strips/*
  const listRes = await fetch(`${AGENT}/nodes`, { cache: "no-store" })
  if (!listRes.ok) {
    return { ok: false, status: listRes.status, platform: "iotvex", index, body: strip }
  }
  const listBody = (await listRes.json()) as { nodes?: AgentOpaqueNode[] }
  const nodes = listBody.nodes || []
  const byId =
    preferredNodeId != null
      ? nodes.find((n) => Number(n.node_id) === Number(preferredNodeId))
      : undefined
  const light = byId || pickLightOpaqueNode(nodes)
  if (!light) {
    return { ok: false, status: 503, platform: "iotvex", index, body: strip, error: "no light node" }
  }

  const res = await fetch(`${AGENT}/node/${light.node_id}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msg_type: MSG.SET_STRIP,
      payload_b64: packSetStripPayload(strip),
      need_ack: true,
    }),
  })
  return { ok: res.ok, status: res.status, platform: "iotvex", index, body: strip, node_id: light.node_id }
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
  const entityId = asEntityId(target) || String(action.entity_id || "")
  if (!entityId) return { ok: false, skipped: true, reason: "no entity_id" }

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
    return {
      ...(await controlIotvexStrip(
        index,
        verb,
        data,
        currentOn,
        Number.isFinite(preferredNodeId) ? preferredNodeId : undefined,
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
  const results = []
  for (const step of actions || []) {
    results.push(await runHomeAction((step || {}) as Record<string, unknown>))
  }
  return results
}
