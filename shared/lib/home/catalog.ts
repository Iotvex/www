
import { createAdminClient } from "@/shared/lib/supabase/admin"
import {
  KIND_LIGHT,
  decodeAgentNodes,
  defaultDeviceModel,
  defaultDeviceName,
  deviceUuidForNode,
  formatSensorValue,
  lightStripEntityId,
  weatherSensorEntityId,
  type AgentOpaqueNode,
  type IotvexNodeView,
} from "@/shared/lib/iotvex-proto"
import type {
  DbAutomation,
  DbEntity,
  DbScene,
  DbScript,
  HomeCatalog,
} from "./types"

export async function loadHomeCatalog(): Promise<HomeCatalog & {
  events: unknown[]
  widgets: unknown[]
  modules: unknown[]
}> {
  const sb = createAdminClient()
  const [
    areas, devices, entities, states, automations, scripts, scenes, events, widgets, modules,
  ] = await Promise.all([
    sb.from("areas").select("*").order("sort_order"),
    sb.from("devices").select("*").order("name"),
    sb.from("entities").select("*").order("name"),
    sb.from("entity_states").select("*"),
    sb.from("automations").select("*").order("name"),
    sb.from("scripts").select("*").order("name"),
    sb.from("scenes").select("*").order("name"),
    sb.from("events").select("*").order("created_at", { ascending: false }).limit(80),
    sb.from("dashboard_widgets").select("*").order("sort_order"),
    sb.from("modules").select("*").order("name"),
  ])
  for (const r of [areas, devices, entities, states, automations, scripts, scenes, events, widgets, modules]) {
    if (r.error) throw new Error(r.error.message)
  }
  return {
    areas: areas.data || [],
    devices: devices.data || [],
    entities: (entities.data || []) as DbEntity[],
    states: states.data || [],
    automations: (automations.data || []) as DbAutomation[],
    scripts: (scripts.data || []) as DbScript[],
    scenes: (scenes.data || []) as DbScene[],
    events: events.data || [],
    widgets: widgets.data || [],
    modules: modules.data || [],
  }
}

export async function listAutomations() {
  const sb = createAdminClient()
  const { data, error } = await sb.from("automations").select("*").order("name")
  if (error) throw new Error(error.message)
  return (data || []) as DbAutomation[]
}

export async function setAutomationEnabled(id: string, enabled: boolean) {
  const sb = createAdminClient()
  const { data, error } = await sb.from("automations").update({ enabled }).eq("id", id).select("*").single()
  if (error) throw new Error(error.message)
  return data as DbAutomation
}

export async function upsertAutomation(row: Partial<DbAutomation> & { id: string; name: string }) {
  const sb = createAdminClient()
  const { data, error } = await sb.from("automations").upsert(row).select("*").single()
  if (error) throw new Error(error.message)
  return data as DbAutomation
}

export async function deleteAutomation(id: string) {
  const sb = createAdminClient()
  const { error } = await sb.from("automations").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function markAutomationTriggered(id: string) {
  const sb = createAdminClient()
  await sb.from("automations").update({ last_triggered: new Date().toISOString() }).eq("id", id)
}

export async function getScript(id: string) {
  const sb = createAdminClient()
  const { data, error } = await sb.from("scripts").select("*").eq("id", id).single()
  if (error) throw new Error(error.message)
  return data as DbScript
}

export async function upsertScript(row: Partial<DbScript> & { id: string; name: string }) {
  const sb = createAdminClient()
  const { data, error } = await sb.from("scripts").upsert(row).select("*").single()
  if (error) throw new Error(error.message)
  return data as DbScript
}

export async function deleteScript(id: string) {
  const sb = createAdminClient()
  const { error } = await sb.from("scripts").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function touchScript(id: string) {
  const sb = createAdminClient()
  await sb.from("scripts").update({ last_triggered: new Date().toISOString() }).eq("id", id)
}

export async function getScene(id: string) {
  const sb = createAdminClient()
  const { data, error } = await sb.from("scenes").select("*").eq("id", id).single()
  if (error) throw new Error(error.message)
  return data as DbScene
}

export async function upsertScene(row: Partial<DbScene> & { id: string; name: string }) {
  const sb = createAdminClient()
  const { data, error } = await sb.from("scenes").upsert(row).select("*").single()
  if (error) throw new Error(error.message)
  return data as DbScene
}

export async function deleteScene(id: string) {
  const sb = createAdminClient()
  const { error } = await sb.from("scenes").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

export async function upsertArea(row: { id: string; name: string; icon?: string | null; sort_order?: number }) {
  const sb = createAdminClient()
  const { data, error } = await sb.from("areas").upsert(row).select("*").single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteArea(id: string) {
  const sb = createAdminClient()
  const { error } = await sb.from("areas").delete().eq("id", id)
  if (error) throw new Error(error.message)
}

function stateSnapshotEqual(
  prev: { state: string; attributes: Record<string, unknown> } | null | undefined,
  state: string,
  attributes: Record<string, unknown>,
): boolean {
  if (!prev) return false
  if (prev.state !== state) return false
  try {
    return JSON.stringify(prev.attributes || {}) === JSON.stringify(attributes || {})
  } catch {
    return false
  }
}

export async function upsertEntityState(
  entityId: string,
  state: string,
  attributes: Record<string, unknown>,
  available = true,
) {
  const sb = createAdminClient()
  const { data: prev } = await sb
    .from("entity_states")
    .select("state,attributes,last_changed")
    .eq("entity_id", entityId)
    .maybeSingle()
  const unchanged = stateSnapshotEqual(prev, state, attributes)
  const { error } = await sb.from("entity_states").upsert({
    entity_id: entityId,
    state,
    attributes,
    available,
    last_changed: unchanged && prev?.last_changed
      ? prev.last_changed
      : new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export function summarizeTrigger(trigger: Record<string, unknown>): string {
  const kind = String(trigger.trigger || trigger.platform || trigger.type || "")
  if (kind === "time") return `time:${trigger.at || trigger.time || "-"}`
  if (kind === "state") {
    const to = trigger.to != null && String(trigger.to) !== "" ? `->${trigger.to}` : ""
    return `state:${trigger.entity_id || "-"}${to}`
  }
  if (kind === "numeric_state") {
    const parts = []
    if (trigger.above != null) parts.push(`>${trigger.above}`)
    if (trigger.below != null) parts.push(`<${trigger.below}`)
    return `numeric:${trigger.entity_id || "?"} ${parts.join(" ")}`.trim()
  }
  if (kind) return kind
  return "trigger"
}

export function summarizeAction(actions: unknown[]): string {
  const a = (actions?.[0] || {}) as Record<string, unknown>
  const service = String(a.action || a.service || "action")
  const target = (a.target || {}) as Record<string, unknown>
  const eid = target.entity_id || target.device_id
  return eid ? `${service} -> ${Array.isArray(eid) ? eid[0] : eid}` : service
}

const EFFECT_LIST = [
  "solid", "rainbow", "chase", "pulse", "sparkle", "theater", "fire", "comet",
  "wave", "scanner", "twinkle", "gradient", "color_loop", "snow",
]

async function assertOk(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`)
}

/** Prefer existing area; never hardcode seed ids — live DBs may use gostinaya etc. */
async function resolveDefaultAreaId(
  sb: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const { data } = await sb.from("areas").select("id").order("sort_order").limit(1).maybeSingle()
  return data?.id ?? null
}

async function upsertLightNode(
  sb: ReturnType<typeof createAdminClient>,
  node: IotvexNodeView,
  found: string[],
  defaultAreaId: string | null,
) {
  const deviceId = deviceUuidForNode(node.node_id)
  const { data: existingDev } = await sb.from("devices").select("*").eq("id", deviceId).maybeSingle()
  const areaId = existingDev?.area_id ?? defaultAreaId
  const { error: deviceErr } = await sb.from("devices").upsert({
    id: deviceId,
    name: existingDev?.name || defaultDeviceName(node.node_id, KIND_LIGHT),
    manufacturer: existingDev?.manufacturer || "Iotvex",
    model: defaultDeviceModel(node.node_id, KIND_LIGHT),
    area_id: areaId,
    platform: "iotvex",
    external_id: String(node.node_id),
    meta: {
      ...(existingDev?.meta || {}),
      host: node.host,
      kind: KIND_LIGHT,
      strip_count: node.strip_count,
      last_seen: new Date().toISOString(),
    },
  })
  await assertOk(deviceErr, `devices upsert ${deviceId}`)

  for (let idx = 0; idx < (node.strips?.length || 0); idx++) {
    const s = node.strips[idx]
    const id = lightStripEntityId(node.node_id, idx)
    found.push(id)
    const { data: existingEnt } = await sb.from("entities").select("*").eq("id", id).maybeSingle()
    const inheritArea = existingEnt?.area_id ?? existingDev?.area_id ?? defaultAreaId
    const defaultName =
      idx === 0 ? "Left Strip" : idx === 1 ? "Right Strip" : `Strip ${idx}`
    const { error: entErr } = await sb.from("entities").upsert({
      id,
      device_id: deviceId,
      domain: "light",
      name: existingEnt?.name || defaultName,
      area_id: inheritArea,
      capabilities: existingEnt?.capabilities?.length
        ? existingEnt.capabilities
        : ["on_off", "brightness", "color", "effect", "speed"],
      attributes: {
        ...(existingEnt?.attributes || {}),
        platform: "iotvex",
        node_id: node.node_id,
        strip_index: idx,
        supported_color_modes: ["rgb", "brightness"],
        effect_list: EFFECT_LIST,
      },
      enabled: existingEnt?.enabled ?? true,
    })
    await assertOk(entErr, `entities upsert ${id}`)
    const nextState = s.on ? "on" : "off"
    const nextAttrs = {
      brightness: s.brightness,
      rgb_color: [s.r, s.g, s.b],
      effect: s.effect ?? 0,
      speed: s.speed ?? 128,
      effect_list: EFFECT_LIST,
    }
    const { data: prevState } = await sb
      .from("entity_states")
      .select("state,attributes,last_changed")
      .eq("entity_id", id)
      .maybeSingle()
    const unchanged = stateSnapshotEqual(prevState, nextState, nextAttrs)
    const { error: stateErr } = await sb.from("entity_states").upsert({
      entity_id: id,
      state: nextState,
      attributes: nextAttrs,
      available: true,
      // Only bump last_changed on real change — cron sync must not re-fire every minute.
      last_changed: unchanged && prevState?.last_changed
        ? prevState.last_changed
        : new Date((node.ts || Date.now() / 1000) * 1000).toISOString(),
    })
    await assertOk(stateErr, `entity_states upsert ${id}`)
  }
}

async function upsertWeatherNode(
  sb: ReturnType<typeof createAdminClient>,
  node: IotvexNodeView,
  found: string[],
  defaultAreaId: string | null,
) {
  const deviceId = deviceUuidForNode(node.node_id)
  const { data: existingDev } = await sb.from("devices").select("*").eq("id", deviceId).maybeSingle()
  const areaId = existingDev?.area_id ?? defaultAreaId
  const { error: deviceErr } = await sb.from("devices").upsert({
    id: deviceId,
    name: existingDev?.name || defaultDeviceName(node.node_id, node.kind),
    manufacturer: existingDev?.manufacturer || "Iotvex",
    model: defaultDeviceModel(node.node_id, node.kind),
    area_id: areaId,
    platform: "iotvex",
    external_id: String(node.node_id),
    meta: {
      ...(existingDev?.meta || {}),
      host: node.host,
      kind: node.kind,
      weather_flags: node.weather?.flags ?? 0,
      last_seen: new Date().toISOString(),
    },
  })
  await assertOk(deviceErr, `devices upsert ${deviceId}`)

  const ts = new Date((node.ts || Date.now() / 1000) * 1000).toISOString()
  for (const sensor of node.sensors) {
    const id = weatherSensorEntityId(node.node_id, sensor.entity_suffix)
    found.push(id)
    const { data: existingEnt } = await sb.from("entities").select("*").eq("id", id).maybeSingle()
    const inheritArea = existingEnt?.area_id ?? existingDev?.area_id ?? defaultAreaId
    const { error: entErr } = await sb.from("entities").upsert({
      id,
      device_id: deviceId,
      domain: "sensor",
      name: existingEnt?.name || sensor.name,
      area_id: inheritArea,
      capabilities: existingEnt?.capabilities?.length
        ? existingEnt.capabilities
        : sensor.capabilities,
      attributes: {
        ...(existingEnt?.attributes || {}),
        platform: "iotvex",
        node_id: node.node_id,
        device_class: sensor.device_class,
        unit_of_measurement: sensor.unit,
        sensor_key: sensor.key,
      },
      enabled: existingEnt?.enabled ?? true,
    })
    await assertOk(entErr, `entities upsert ${id}`)
    const nextState = formatSensorValue(sensor.value, sensor.digits)
    const nextAttrs = {
      unit_of_measurement: sensor.unit,
      device_class: sensor.device_class,
    }
    const { data: prevState } = await sb
      .from("entity_states")
      .select("state,attributes,last_changed")
      .eq("entity_id", id)
      .maybeSingle()
    const unchanged = stateSnapshotEqual(prevState, nextState, nextAttrs)
    const { error: stateErr } = await sb.from("entity_states").upsert({
      entity_id: id,
      state: nextState,
      attributes: nextAttrs,
      available: true,
      last_changed: unchanged && prevState?.last_changed ? prevState.last_changed : ts,
    })
    await assertOk(stateErr, `entity_states upsert ${id}`)
  }
}

/** Discover all online agent nodes into catalog (lights + opaque weather sensors). */
export async function discoverFromAgent(agentUrl: string) {
  const sb = createAdminClient()
  const res = await fetch(`${agentUrl.replace(/\/$/, "")}/nodes`, { cache: "no-store" })
  if (!res.ok) throw new Error(`agent ${res.status}`)
  const body = (await res.json()) as { nodes?: AgentOpaqueNode[] }
  const nodes = decodeAgentNodes(body.nodes || [])
  if (!nodes.length) throw new Error("no nodes online")

  const defaultAreaId = await resolveDefaultAreaId(sb)
  const found: string[] = []
  for (const node of nodes) {
    if (node.kind === KIND_LIGHT && node.strips.length > 0) {
      await upsertLightNode(sb, node, found, defaultAreaId)
    } else if (node.sensors.length > 0 || node.weather) {
      await upsertWeatherNode(sb, node, found, defaultAreaId)
    }
  }

  return { nodes, entities: found }
}

/** Soft sync for automation cron — updates entity_states without failing the tick. */
export async function syncAgentStates(agentUrl: string) {
  return discoverFromAgent(agentUrl)
}
