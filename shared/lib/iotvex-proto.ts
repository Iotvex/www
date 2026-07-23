/**
 * Iotvex UDP protocol v1 helpers (payload pack/unpack for www).
 * Wire layout matches libs/core/src/proto — agent only forwards opaque bytes.
 */

export const MSG = {
  HELLO: 0x01,
  HELLO_ACK: 0x02,
  GET_STATE: 0x03,
  STATE: 0x04,
  SET_STRIP: 0x05,
  SET_ALL: 0x06,
  ACK: 0x07,
  NACK: 0x08,
} as const

export const STRIP_SIZE = 8
export const MAX_STRIPS = 8

/** Packed WeatherStateV1 from living-room-weather-station firmware (30 bytes). */
export const WEATHER_STATE_V1_SIZE = 30
export const WEATHER_FLAG_SCD = 1 << 0
export const WEATHER_FLAG_BH1750 = 1 << 1
export const WEATHER_FLAG_BME280 = 1 << 2

/** Known node ids (board_config.h). */
export const NODE_ID_LIVING_ROOM_LIGHT = 0x4c524c31 // 'LRL1'
export const NODE_ID_LIVING_ROOM_WEATHER = 0x4c525733 // 'LRW3'

export type ProtoStrip = {
  index: number
  on: boolean
  brightness: number
  r: number
  g: number
  b: number
  effect: number
  speed: number
}

export const KIND_LIGHT = 0
export const KIND_OPAQUE = 1

export type ProtoHelloAck = {
  node_id: number
  /** Capability byte on the wire (v1: strip count for lights). */
  strip_count: number
  /** HELLO_ACK.reserved: 0=light strips, 1=opaque STATE blob. */
  kind: number
}

export type ProtoState = {
  strips: ProtoStrip[]
}

/** Opaque weather STATE v1 (little-endian floats). */
export type WeatherStateV1 = {
  version: number
  flags: number
  co2_ppm: number
  scd_temp_c: number
  scd_rh_pct: number
  lux: number
  bme_temp_c: number
  bme_rh_pct: number
  pressure_hpa: number
}

/** One HA-style sensor derived from opaque weather STATE. */
export type WeatherSensorReading = {
  key: string
  entity_suffix: string
  name: string
  value: number
  unit: string
  device_class: string
  capabilities: Array<"value" | "temperature" | "humidity">
  digits: number
}

export type AgentOpaqueNode = {
  host: string
  node_id: number
  id?: string
  ts: number
  hello_b64: string
  state_b64: string
}

export type IotvexNodeView = {
  host: string
  node_id: number
  /** HELLO kind: 0=light, 1=opaque. */
  kind: number
  strip_count: number
  strips: ProtoStrip[]
  /** Decoded weather STATE when kind=opaque and layout matches v1. */
  weather: WeatherStateV1 | null
  /** Capability-driven sensor readings from weather (empty for lights). */
  sensors: WeatherSensorReading[]
  ts: number
}

function u8(n: number): number {
  return Math.max(0, Math.min(255, Math.trunc(n))) >>> 0
}

/** Pack one strip blob (SET_STRIP / SET_ALL payload). */
export function packStrip(s: ProtoStrip): Uint8Array {
  const out = new Uint8Array(STRIP_SIZE)
  out[0] = u8(s.index)
  out[1] = s.on ? 1 : 0
  out[2] = u8(s.brightness)
  out[3] = u8(s.r)
  out[4] = u8(s.g)
  out[5] = u8(s.b)
  out[6] = u8(s.effect)
  out[7] = u8(s.speed)
  return out
}

export function unpackStrip(data: Uint8Array, offset = 0): ProtoStrip {
  if (data.length < offset + STRIP_SIZE) {
    throw new Error("strip payload too short")
  }
  return {
    index: data[offset],
    on: data[offset + 1] !== 0,
    brightness: data[offset + 2],
    r: data[offset + 3],
    g: data[offset + 4],
    b: data[offset + 5],
    effect: data[offset + 6],
    speed: data[offset + 7],
  }
}

export function unpackHelloAck(data: Uint8Array): ProtoHelloAck {
  if (data.length < 6) throw new Error("hello_ack payload too short")
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return {
    node_id: view.getUint32(0, true),
    strip_count: data[4],
    kind: data[5] ?? KIND_LIGHT,
  }
}

export function unpackState(data: Uint8Array): ProtoState {
  if (!data.length) throw new Error("state payload empty")
  const count = data[0]
  if (count > MAX_STRIPS) throw new Error("strip_count too large")
  const need = 1 + count * STRIP_SIZE
  if (data.length < need) throw new Error("state payload truncated")
  const strips: ProtoStrip[] = []
  for (let i = 0; i < count; i++) {
    strips.push(unpackStrip(data, 1 + i * STRIP_SIZE))
  }
  return { strips }
}

/** Decode packed WeatherStateV1 (30 bytes LE). */
export function unpackWeatherStateV1(data: Uint8Array): WeatherStateV1 {
  if (data.length < WEATHER_STATE_V1_SIZE) {
    throw new Error("weather state payload too short")
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return {
    version: data[0],
    flags: data[1],
    co2_ppm: view.getFloat32(2, true),
    scd_temp_c: view.getFloat32(6, true),
    scd_rh_pct: view.getFloat32(10, true),
    lux: view.getFloat32(14, true),
    bme_temp_c: view.getFloat32(18, true),
    bme_rh_pct: view.getFloat32(22, true),
    pressure_hpa: view.getFloat32(26, true),
  }
}

/** Map weather STATE flags → sensor entities (skip missing sensors). */
export function weatherSensorsFromState(w: WeatherStateV1): WeatherSensorReading[] {
  if (w.version !== 1) return []
  const out: WeatherSensorReading[] = []
  const scd = (w.flags & WEATHER_FLAG_SCD) !== 0
  const bh = (w.flags & WEATHER_FLAG_BH1750) !== 0
  const bme = (w.flags & WEATHER_FLAG_BME280) !== 0

  if (scd) {
    out.push({
      key: "co2",
      entity_suffix: "co2",
      name: "CO₂",
      value: w.co2_ppm,
      unit: "ppm",
      device_class: "carbon_dioxide",
      capabilities: ["value"],
      digits: 0,
    })
    out.push({
      key: "temperature",
      entity_suffix: "temperature",
      name: "Temperature",
      value: w.scd_temp_c,
      unit: "°C",
      device_class: "temperature",
      capabilities: ["temperature", "value"],
      digits: 1,
    })
    out.push({
      key: "humidity",
      entity_suffix: "humidity",
      name: "Humidity",
      value: w.scd_rh_pct,
      unit: "%",
      device_class: "humidity",
      capabilities: ["humidity", "value"],
      digits: 0,
    })
  } else if (bme) {
    out.push({
      key: "temperature",
      entity_suffix: "temperature",
      name: "Temperature",
      value: w.bme_temp_c,
      unit: "°C",
      device_class: "temperature",
      capabilities: ["temperature", "value"],
      digits: 1,
    })
    out.push({
      key: "humidity",
      entity_suffix: "humidity",
      name: "Humidity",
      value: w.bme_rh_pct,
      unit: "%",
      device_class: "humidity",
      capabilities: ["humidity", "value"],
      digits: 0,
    })
  }

  if (bh) {
    out.push({
      key: "illuminance",
      entity_suffix: "illuminance",
      name: "Illuminance",
      value: w.lux,
      unit: "lx",
      device_class: "illuminance",
      capabilities: ["value"],
      digits: 0,
    })
  }

  if (bme) {
    out.push({
      key: "pressure",
      entity_suffix: "pressure",
      name: "Pressure",
      value: w.pressure_hpa,
      unit: "hPa",
      device_class: "pressure",
      capabilities: ["value"],
      digits: 1,
    })
  }

  return out
}

export function formatSensorValue(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "unknown"
  return value.toFixed(digits)
}

export function b64Encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64")
}

export function b64Decode(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"))
}

export function nodeIdHex(nodeId: number): string {
  return (nodeId >>> 0).toString(16).padStart(8, "0")
}

/** Stable catalog device UUID from numeric node id (preserves light seed UUID). */
export function deviceUuidForNode(nodeId: number): string {
  if ((nodeId >>> 0) === NODE_ID_LIVING_ROOM_LIGHT) {
    return "a0000000-0000-4000-8000-000000000001"
  }
  const hex = nodeIdHex(nodeId)
  return `a0000000-0000-4000-8000-${hex.padStart(12, "0")}`
}

/** Entity id slug prefix for a node (used for lights/sensors). */
export function nodeEntitySlug(nodeId: number): string {
  const id = nodeId >>> 0
  if (id === NODE_ID_LIVING_ROOM_LIGHT) return "living_room"
  if (id === NODE_ID_LIVING_ROOM_WEATHER) return "living_room_weather"
  return `node_${nodeIdHex(id)}`
}

export function defaultDeviceName(nodeId: number, kind: number): string {
  const id = nodeId >>> 0
  if (id === NODE_ID_LIVING_ROOM_LIGHT) return "Living Room Light"
  if (id === NODE_ID_LIVING_ROOM_WEATHER) return "Living Room Weather"
  if (kind === KIND_LIGHT) return `Light ${nodeIdHex(id)}`
  return `Node ${nodeIdHex(id)}`
}

export function defaultDeviceModel(nodeId: number, kind: number): string {
  const id = nodeId >>> 0
  if (id === NODE_ID_LIVING_ROOM_LIGHT) return "living-room-light"
  if (id === NODE_ID_LIVING_ROOM_WEATHER) return "living-room-weather-station"
  return kind === KIND_LIGHT ? "LED controller" : "opaque node"
}

export function lightStripEntityId(nodeId: number, stripIndex: number): string {
  const slug = nodeEntitySlug(nodeId)
  if ((nodeId >>> 0) === NODE_ID_LIVING_ROOM_LIGHT) {
    return `light.living_room_strip_${stripIndex}`
  }
  return `light.${slug}_strip_${stripIndex}`
}

export function weatherSensorEntityId(nodeId: number, suffix: string): string {
  return `sensor.${nodeEntitySlug(nodeId)}_${suffix}`
}

function tryUnpackWeather(stateB64: string): WeatherStateV1 | null {
  try {
    const raw = b64Decode(stateB64)
    if (raw.length < WEATHER_STATE_V1_SIZE) return null
    const w = unpackWeatherStateV1(raw)
    if (w.version !== 1) return null
    return w
  } catch {
    return null
  }
}

/** Decode agent opaque snapshot into the UI/catalog node shape. */
export function decodeAgentNode(agent: AgentOpaqueNode): IotvexNodeView {
  const hello = unpackHelloAck(b64Decode(agent.hello_b64))
  const nodeId = agent.node_id || hello.node_id

  if (hello.kind === KIND_OPAQUE || hello.strip_count === 0) {
    const weather = tryUnpackWeather(agent.state_b64)
    return {
      host: agent.host,
      node_id: nodeId,
      kind: hello.kind === KIND_OPAQUE ? KIND_OPAQUE : hello.kind,
      strip_count: 0,
      strips: [],
      weather,
      sensors: weather ? weatherSensorsFromState(weather) : [],
      ts: agent.ts,
    }
  }

  const state = unpackState(b64Decode(agent.state_b64))
  return {
    host: agent.host,
    node_id: nodeId,
    kind: KIND_LIGHT,
    strip_count: hello.strip_count || state.strips.length,
    strips: state.strips,
    weather: null,
    sensors: [],
    ts: agent.ts,
  }
}

export function decodeAgentNodes(agents: AgentOpaqueNode[]): IotvexNodeView[] {
  return agents.map((a) => {
    try {
      return decodeAgentNode(a)
    } catch {
      return {
        host: a.host,
        node_id: a.node_id,
        kind: KIND_OPAQUE,
        strip_count: 0,
        strips: [],
        weather: null,
        sensors: [],
        ts: a.ts,
      }
    }
  })
}

export function isLightNodeView(n: IotvexNodeView): boolean {
  return n.kind === KIND_LIGHT && n.strip_count > 0
}

export function isWeatherNodeView(n: IotvexNodeView): boolean {
  return n.kind === KIND_OPAQUE && (n.weather != null || n.sensors.length > 0)
}

/** Prefer a light-strip node when targeting SET_STRIP (e.g. weather + light online). */
export function pickLightOpaqueNode(
  nodes: AgentOpaqueNode[],
): AgentOpaqueNode | null {
  if (!nodes.length) return null
  for (const n of nodes) {
    try {
      const hello = unpackHelloAck(b64Decode(n.hello_b64))
      if (hello.kind === KIND_LIGHT && hello.strip_count > 0) return n
    } catch {
      /* skip */
    }
  }
  return null
}

export function pickLightNodeView(nodes: IotvexNodeView[]): IotvexNodeView | null {
  return nodes.find(isLightNodeView) ?? null
}

export function packSetStripPayload(s: ProtoStrip): string {
  return b64Encode(packStrip(s))
}
