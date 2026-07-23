"use client"

import { combine, createStore, createEvent, createEffect, sample } from "effector"
import { inferCapabilities } from "./capabilities"
import { defaultStripName, DEFAULT_EFFECT_LIST } from "@/shared/lib/home/action-options"
import {
  defaultDeviceModel,
  defaultDeviceName,
  deviceUuidForNode,
  formatSensorValue,
  lightStripEntityId,
  pickLightNodeView,
  weatherSensorEntityId,
} from "@/shared/lib/iotvex-proto"
import type {
  Area,
  Device,
  EntityCapability,
  EntityState,
  IotvexNode,
  IotvexNodesPayload,
  StripState,
} from "./types"

export const setEntities = createEvent<EntityState[]>()
export const upsertEntity = createEvent<EntityState>()
export const setAreas = createEvent<Area[]>()
export const setDevices = createEvent<Device[]>()
export const setNode = createEvent<IotvexNode | null>()
export const setNodes = createEvent<IotvexNode[]>()
export const setNodeError = createEvent<string | null>()
export const catalogLoaded = createEvent<{
  areas: Area[]
  devices: Device[]
  entities: EntityState[]
}>()

type StripPatch = { index: number } & Partial<StripState>

export type EntityCommand =
  | { entity_id: string; action: "turn_on" }
  | { entity_id: string; action: "turn_off" }
  | { entity_id: string; action: "toggle" }
  | { entity_id: string; action: "set_brightness"; brightness: number }
  | { entity_id: string; action: "set_color"; r: number; g: number; b: number }
  | { entity_id: string; action: "set_effect"; effect: number; speed?: number }
  | { entity_id: string; action: "set_speed"; speed: number }
  /** Full strip power write (keeps color/effect; optional brightness restore on off). */
  | { entity_id: string; action: "set_power"; on: boolean; brightness?: number }

function stripFieldsFromEntity(e: EntityState): Omit<StripState, "index"> {
  const rgb = (e.attributes.rgb_color as number[] | undefined) || [255, 255, 255]
  return {
    on: e.state === "on",
    brightness: Number(e.attributes.brightness ?? 255),
    r: Number(rgb[0] ?? 255),
    g: Number(rgb[1] ?? 255),
    b: Number(rgb[2] ?? 255),
    effect: Number(e.attributes.effect ?? 0),
    speed: Number(e.attributes.speed ?? 128),
  }
}

function applyEntityCommand(entities: EntityState[], cmd: EntityCommand): EntityState[] {
  return entities.map((e) => {
    if (e.entity_id !== cmd.entity_id) return e
    const attrs = { ...e.attributes }
    let state = e.state

    if (cmd.action === "turn_on") state = "on"
    if (cmd.action === "turn_off") state = "off"
    if (cmd.action === "toggle") state = state === "on" ? "off" : "on"
    if (cmd.action === "set_power") {
      state = cmd.on ? "on" : "off"
      if (cmd.brightness != null) attrs.brightness = cmd.brightness
    }
    if (cmd.action === "set_brightness") {
      state = "on"
      attrs.brightness = cmd.brightness
    }
    if (cmd.action === "set_color") {
      state = "on"
      attrs.rgb_color = [cmd.r, cmd.g, cmd.b]
    }
    if (cmd.action === "set_effect") {
      state = "on"
      attrs.effect = cmd.effect
      if (cmd.speed != null) attrs.speed = cmd.speed
    }
    if (cmd.action === "set_speed") {
      state = "on"
      attrs.speed = cmd.speed
    }

    return {
      ...e,
      state,
      attributes: attrs,
      last_changed: new Date().toISOString(),
    }
  })
}

/** Always send a full strip body so brightness/color/effect stay independent. */
function commandToStripPatch(entities: EntityState[], cmd: EntityCommand): StripPatch | null {
  const e = entities.find((x) => x.entity_id === cmd.entity_id)
  if (!e) return null
  const index = Number(e.attributes.strip_index)
  if (!Number.isFinite(index)) return null

  const base = stripFieldsFromEntity(e)

  if (cmd.action === "turn_on") return { index, ...base, on: true }
  if (cmd.action === "turn_off") return { index, ...base, on: false }
  if (cmd.action === "toggle") return { index, ...base, on: e.state !== "on" }
  if (cmd.action === "set_power") {
    return {
      index,
      ...base,
      on: cmd.on,
      brightness: cmd.brightness != null ? cmd.brightness : base.brightness,
    }
  }
  if (cmd.action === "set_brightness") {
    return { index, ...base, brightness: cmd.brightness, on: true }
  }
  if (cmd.action === "set_color") {
    return { index, ...base, r: cmd.r, g: cmd.g, b: cmd.b, on: true }
  }
  if (cmd.action === "set_effect") {
    return {
      index,
      ...base,
      effect: cmd.effect,
      speed: cmd.speed != null ? cmd.speed : base.speed,
      on: true,
    }
  }
  if (cmd.action === "set_speed") return { index, ...base, speed: cmd.speed, on: true }
  return null
}

function mergeLightNode(byId: Map<string, EntityState>, node: IotvexNode) {
  const deviceId = deviceUuidForNode(node.node_id)
  node.strips.forEach((s, idx) => {
    const entityId = lightStripEntityId(node.node_id, idx)
    const existing = byId.get(entityId)
    const attributes: Record<string, unknown> = {
      ...(existing?.attributes || {}),
      brightness: s.brightness,
      rgb_color: [s.r, s.g, s.b],
      effect: s.effect,
      speed: s.speed,
      supported_color_modes: ["rgb", "brightness"],
      color_mode: "rgb",
      strip_index: idx,
      node_id: node.node_id,
      platform: "iotvex",
      effect_list: existing?.attributes?.effect_list || DEFAULT_EFFECT_LIST,
      friendly_name: existing?.name || defaultStripName(idx),
    }
    const caps =
      existing?.capabilities?.length
        ? existing.capabilities
        : inferCapabilities("light", attributes)

    byId.set(entityId, {
      entity_id: entityId,
      domain: "light",
      name: existing?.name || defaultStripName(idx),
      state: s.on ? "on" : "off",
      available: true,
      area: existing?.area,
      device_id: existing?.device_id || deviceId,
      last_changed: new Date(node.ts * 1000).toISOString(),
      attributes,
      capabilities: caps,
    })
  })
}

function mergeWeatherNode(byId: Map<string, EntityState>, node: IotvexNode) {
  const deviceId = deviceUuidForNode(node.node_id)
  const ts = new Date(node.ts * 1000).toISOString()
  for (const sensor of node.sensors || []) {
    const entityId = weatherSensorEntityId(node.node_id, sensor.entity_suffix)
    const existing = byId.get(entityId)
    const attributes: Record<string, unknown> = {
      ...(existing?.attributes || {}),
      unit_of_measurement: sensor.unit,
      device_class: sensor.device_class,
      sensor_key: sensor.key,
      node_id: node.node_id,
      platform: "iotvex",
      friendly_name: existing?.name || sensor.name,
    }
    const caps =
      existing?.capabilities?.length
        ? existing.capabilities
        : (sensor.capabilities as EntityCapability[])

    byId.set(entityId, {
      entity_id: entityId,
      domain: "sensor",
      name: existing?.name || sensor.name,
      state: formatSensorValue(sensor.value, sensor.digits),
      available: true,
      area: existing?.area,
      device_id: existing?.device_id || deviceId,
      last_changed: ts,
      attributes,
      capabilities: caps,
    })
  }
}

/** Merge live agent nodes onto catalog entities (DB is metadata SoT). */
function mergeLiveOntoCatalog(prev: EntityState[], nodes: IotvexNode[]): EntityState[] {
  const byId = new Map(prev.map((e) => [e.entity_id, e]))
  for (const node of nodes) {
    if (node.strips?.length) mergeLightNode(byId, node)
    if (node.sensors?.length) mergeWeatherNode(byId, node)
  }
  return [...byId.values()]
}

/** Ensure online nodes have a parent Device row so inventory can nest entities. */
function deviceFromNode(node: IotvexNode, existing?: Device, fallbackAreaId?: string | null): Device {
  return {
    id: deviceUuidForNode(node.node_id),
    name: existing?.name || defaultDeviceName(node.node_id, node.kind),
    manufacturer: existing?.manufacturer ?? "Iotvex",
    model: existing?.model || defaultDeviceModel(node.node_id, node.kind),
    // Never invent seed area ids — live catalogs may use gostinaya / custom ids.
    area_id: existing?.area_id ?? fallbackAreaId ?? null,
    platform: existing?.platform || "iotvex",
    external_id: existing?.external_id ?? String(node.node_id),
    meta: {
      ...(existing?.meta || {}),
      host: node.host,
      kind: node.kind,
      ...(node.weather ? { weather_flags: node.weather.flags } : {}),
      ...(node.strips?.length ? { strip_count: node.strips.length } : {}),
    },
  }
}

function mergeLiveDevicesOntoCatalog(prev: Device[], nodes: IotvexNode[]): Device[] {
  const byId = new Map(prev.map((d) => [d.id, d]))
  const fallbackAreaId =
    [...byId.values()].find((d) => d.area_id)?.area_id ?? null
  for (const node of nodes) {
    if (!node.strips?.length && !node.sensors?.length) continue
    const id = deviceUuidForNode(node.node_id)
    byId.set(id, deviceFromNode(node, byId.get(id), fallbackAreaId))
  }
  return [...byId.values()]
}

function nodeMissingFromCatalog(catalogIds: Set<string>, node: IotvexNode): boolean {
  if (!node.strips?.length && !node.sensors?.length) return false
  return !catalogIds.has(deviceUuidForNode(node.node_id))
}

/** Device ids last loaded from Supabase (not live-synthesized). */
const $catalogDeviceIds = createStore<Set<string>>(new Set()).on(
  catalogLoaded,
  (_, v) => new Set(v.devices.map((d) => d.id)),
)

export const fetchCatalogFx = createEffect(async () => {
  const res = await fetch("/api/home", { cache: "no-store" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<{
    areas: Array<{ id: string; name: string; icon?: string | null }>
    devices: Array<{
      id: string
      name: string
      manufacturer: string | null
      model: string | null
      area_id: string | null
      platform: string
      external_id: string | null
      meta: Record<string, unknown>
    }>
    entities: Array<{
      id: string
      device_id: string | null
      domain: string
      name: string
      area_id: string | null
      capabilities: string[]
      attributes: Record<string, unknown>
      enabled: boolean
    }>
    states: Array<{
      entity_id: string
      state: string
      attributes: Record<string, unknown>
      available: boolean
      last_changed: string
    }>
  }>
})

/** AbortSignal.timeout is missing on some mobile WebViews — never throw into "offline". */
function abortAfter(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms)
  }
  const ctrl = new AbortController()
  setTimeout(() => ctrl.abort(), ms)
  return ctrl.signal
}

export const fetchNodeFx = createEffect(async (): Promise<IotvexNodesPayload> => {
  const res = await fetch("/api/iotvex/nodes", {
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    signal: abortAfter(8000),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  const body = (await res.json()) as IotvexNodesPayload
  return { nodes: body.nodes || [] }
})

export const fetchAgentHealthFx = createEffect(async (): Promise<boolean> => {
  try {
    const res = await fetch("/api/iotvex/health", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      signal: abortAfter(4000),
    })
    if (!res.ok) return false
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null
    return Boolean(body?.ok)
  } catch {
    return false
  }
})

export const setStripFx = createEffect(async (payload: StripPatch) => {
  const { index, ...body } = payload
  const res = await fetch(`/api/iotvex/strips/${index}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `HTTP ${res.status}`)
  }
  return (await res.json()) as IotvexNode
})

export const callEntityFx = createEffect(
  async ({ entities, cmd }: { entities: EntityState[]; cmd: EntityCommand }) => {
    const patch = commandToStripPatch(entities, cmd)
    if (!patch) return null
    const { index, ...body } = patch
    const res = await fetch(`/api/iotvex/strips/${index}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(txt || `HTTP ${res.status}`)
    }
    return (await res.json()) as IotvexNode
  },
)

export const $entities = createStore<EntityState[]>([])
  .on(setEntities, (_, v) => v)
  .on(upsertEntity, (list, e) => {
    const i = list.findIndex((x) => x.entity_id === e.entity_id)
    if (i === -1) return [...list, e]
    const next = list.slice()
    next[i] = e
    return next
  })

export const $areas = createStore<Area[]>([])
  .on(setAreas, (_, v) => v)
  .on(catalogLoaded, (_, v) => v.areas)

export const $devices = createStore<Device[]>([])
  .on(setDevices, (_, v) => v)

export const $nodes = createStore<IotvexNode[]>([])
  .on(setNodes, (_, v) => v)
  .on(fetchNodeFx.doneData, (_, v) => v.nodes)
  .on(setStripFx.doneData, (prev, node) => {
    const i = prev.findIndex((n) => n.node_id === node.node_id)
    if (i === -1) return [...prev, node]
    const next = prev.slice()
    next[i] = node
    return next
  })
  .on(callEntityFx.doneData, (prev, node) => {
    if (!node) return prev
    const i = prev.findIndex((n) => n.node_id === node.node_id)
    if (i === -1) return [...prev, node]
    const next = prev.slice()
    next[i] = node
    return next
  })

/** Primary light node (compat for strip count / host in overview). */
export const $node = createStore<IotvexNode | null>(null)
  .on(setNode, (_, v) => v)
  .on(fetchNodeFx.doneData, (_, v) => pickLightNodeView(v.nodes) ?? v.nodes[0] ?? null)
  .on(setStripFx.doneData, (_, v) => v)
  .on(callEntityFx.doneData, (state, v) => v ?? state)

export const $nodeError = createStore<string | null>(null)
  .on(setNodeError, (_, v) => v)
  .on(fetchNodeFx.failData, (_, e) => e.message)
  .on(fetchNodeFx.done, () => null)
  .on(setStripFx.failData, (_, e) => e.message)
  .on(callEntityFx.failData, (_, e) => e.message)
  .on(fetchCatalogFx.failData, (_, e) => e.message)

/**
 * Agent reachability — health OR successful node fetch.
 * Keep signals separate so a late health=false cannot wipe a good /node (race),
 * and health=true still shows Online when strip decode fails.
 *
 * Do not treat "not yet polled" as Offline (common on slow mobile / PWA resume).
 */
export const $agentHealthOk = createStore(false)
  .on(fetchAgentHealthFx.doneData, (_, ok) => ok)
  .on(fetchAgentHealthFx.fail, () => false)

export const $agentNodeOk = createStore(false)
  .on(fetchNodeFx.done, () => true)
  .on(fetchNodeFx.fail, () => false)

/** True after at least one health or node probe finished (success or failure). */
export const $agentProbed = createStore(false)
  .on(fetchAgentHealthFx.finally, () => true)
  .on(fetchNodeFx.finally, () => true)

export const $agentOnline = combine(
  $agentHealthOk,
  $agentNodeOk,
  (healthOk, nodeOk) => healthOk || nodeOk,
)

export type AgentConnection = "pending" | "online" | "offline"

export const $agentConnection = combine(
  $agentProbed,
  $agentOnline,
  (probed, online): AgentConnection => {
    if (!probed) return "pending"
    return online ? "online" : "offline"
  },
)

export const $lights = $entities.map((list) => list.filter((e) => e.domain === "light"))
export const $switches = $entities.map((list) => list.filter((e) => e.domain === "switch"))
export const $sensors = $entities.map((list) =>
  list.filter((e) => e.domain === "sensor" || e.domain === "binary_sensor" || e.domain === "weather"),
)

export const callEntityRequested = createEvent<EntityCommand>()

export function callEntity(cmd: EntityCommand) {
  callEntityRequested(cmd)
}

const RAMP_STEPS = 10
const RAMP_MS = 450
const rampingEntities = new Set<string>()

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Fade brightness toward 0 then off, or on then fade up — preserves RGB/effect/speed. */
export async function smoothToggleEntity(entityId: string, turnOn: boolean) {
  if (rampingEntities.has(entityId)) return
  const entity = $entities.getState().find((e) => e.entity_id === entityId)
  if (!entity) return

  const index = Number(entity.attributes.strip_index)
  const hasStrip = Number.isFinite(index)
  const canRamp =
    hasStrip &&
    (entity.capabilities?.includes("brightness") ||
      Number.isFinite(Number(entity.attributes.brightness)))

  if (!canRamp) {
    callEntity({ entity_id: entityId, action: turnOn ? "turn_on" : "turn_off" })
    return
  }

  const savedBri = Math.max(1, Number(entity.attributes.brightness ?? 128))
  const stepMs = Math.round(RAMP_MS / RAMP_STEPS)
  rampingEntities.add(entityId)

  const write = async (fields: { on: boolean; brightness: number }) => {
    callEntity({
      entity_id: entityId,
      action: "set_power",
      on: fields.on,
      brightness: fields.brightness,
    })
    await sleep(stepMs)
  }

  try {
    if (!turnOn) {
      for (let i = 1; i <= RAMP_STEPS; i++) {
        const brightness = Math.max(1, Math.round(savedBri * (1 - i / RAMP_STEPS)))
        await write({ on: true, brightness })
      }
      callEntity({
        entity_id: entityId,
        action: "set_power",
        on: false,
        brightness: savedBri,
      })
      return
    }

    await write({ on: true, brightness: 1 })
    for (let i = 2; i <= RAMP_STEPS; i++) {
      const brightness = Math.max(1, Math.round(savedBri * (i / RAMP_STEPS)))
      await write({ on: true, brightness })
    }
    callEntity({
      entity_id: entityId,
      action: "set_power",
      on: true,
      brightness: savedBri,
    })
  } finally {
    rampingEntities.delete(entityId)
  }
}

sample({
  clock: callEntityRequested,
  source: $entities,
  fn: (entities, cmd) => ({ entities, cmd }),
  target: callEntityFx,
})

sample({
  clock: callEntityRequested,
  source: $entities,
  fn: (entities, cmd) => applyEntityCommand(entities, cmd),
  target: setEntities,
})

sample({
  clock: fetchCatalogFx.doneData,
  fn: (catalog) => {
    const stateById = new Map(catalog.states.map((s) => [s.entity_id, s]))
    const areas: Area[] = catalog.areas.map((a) => ({
      id: a.id,
      name: a.name,
      icon: a.icon || undefined,
    }))
    const devices: Device[] = (catalog.devices || []).map((d) => ({
      id: d.id,
      name: d.name,
      manufacturer: d.manufacturer,
      model: d.model,
      area_id: d.area_id,
      platform: d.platform,
      external_id: d.external_id,
      meta: d.meta || {},
    }))
    const entities: EntityState[] = catalog.entities
      .filter((e) => e.enabled)
      .map((e) => {
        const st = stateById.get(e.id)
        const attributes = {
          ...(e.attributes || {}),
          ...(st?.attributes || {}),
          friendly_name: e.name,
        }
        const caps = (e.capabilities?.length
          ? e.capabilities
          : inferCapabilities(e.domain as EntityState["domain"], attributes)) as EntityCapability[]
        return {
          entity_id: e.id,
          domain: e.domain as EntityState["domain"],
          name: e.name,
          state: st?.state || "unknown",
          available: st?.available ?? true,
          area: e.area_id || undefined,
          device_id: e.device_id || null,
          last_changed: st?.last_changed,
          attributes,
          capabilities: caps,
        }
      })
    return { areas, devices, entities }
  },
  target: catalogLoaded,
})

/** Catalog reload must not drop live-only weather/light rows until discover persists them. */
sample({
  clock: catalogLoaded,
  source: $nodes,
  fn: (nodes, catalog) => mergeLiveOntoCatalog(catalog.entities, nodes),
  target: setEntities,
})

sample({
  clock: catalogLoaded,
  source: $nodes,
  fn: (nodes, catalog) => mergeLiveDevicesOntoCatalog(catalog.devices, nodes),
  target: setDevices,
})

sample({
  clock: fetchNodeFx.doneData,
  source: $entities,
  fn: (prev, payload) => mergeLiveOntoCatalog(prev, payload.nodes),
  target: setEntities,
})

sample({
  clock: fetchNodeFx.doneData,
  source: $devices,
  fn: (prev, payload) => mergeLiveDevicesOntoCatalog(prev, payload.nodes),
  target: setDevices,
})

sample({
  clock: setStripFx.doneData,
  source: $entities,
  fn: (prev, node) => mergeLiveOntoCatalog(prev, [node]),
  target: setEntities,
})

sample({
  clock: setStripFx.doneData,
  source: $devices,
  fn: (prev, node) => mergeLiveDevicesOntoCatalog(prev, [node]),
  target: setDevices,
})

sample({
  clock: callEntityFx.doneData,
  source: $entities,
  filter: (_prev, node) => node != null,
  fn: (prev, node) => mergeLiveOntoCatalog(prev, [node as IotvexNode]),
  target: setEntities,
})

sample({
  clock: callEntityFx.doneData,
  source: $devices,
  filter: (_prev, node) => node != null,
  fn: (prev, node) => mergeLiveDevicesOntoCatalog(prev, [node as IotvexNode]),
  target: setDevices,
})

/** Persist missing online nodes into Supabase catalog (weather has no seed device). */
export const ensureDiscoveredFx = createEffect(async () => {
  const res = await fetch("/api/devices/discover", { method: "POST" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
})

sample({
  clock: fetchNodeFx.doneData,
  source: combine($catalogDeviceIds, ensureDiscoveredFx.pending),
  filter: ([catalogIds, pending], payload) => {
    if (pending) return false
    return payload.nodes.some((n) => nodeMissingFromCatalog(catalogIds, n))
  },
  target: ensureDiscoveredFx,
})

sample({
  clock: ensureDiscoveredFx.done,
  target: fetchCatalogFx,
})

sample({
  clock: [setStripFx.fail, callEntityFx.fail],
  target: fetchNodeFx,
})
