export type DeviceDomain =
  | "light"
  | "switch"
  | "sensor"
  | "binary_sensor"
  | "climate"
  | "media_player"
  | "cover"
  | "fan"
  | "lock"
  | "camera"
  | "automation"
  | "scene"
  | "script"
  | "person"
  | "weather"
  | "other"

export type EntityCapability =
  | "on_off"
  | "brightness"
  | "color"
  | "effect"
  | "speed"
  | "temperature"
  | "humidity"
  | "binary"
  | "value"

export type EntityState = {
  entity_id: string
  domain: DeviceDomain
  name: string
  state: string
  attributes: Record<string, unknown>
  capabilities: EntityCapability[]
  area?: string
  device_id?: string | null
  last_changed?: string
  available: boolean
}

export type Area = {
  id: string
  name: string
  icon?: string
}

export type Device = {
  id: string
  name: string
  manufacturer: string | null
  model: string | null
  area_id: string | null
  platform: string
  external_id: string | null
  meta: Record<string, unknown>
}

export type StripState = {
  index: number
  on: boolean
  brightness: number
  r: number
  g: number
  b: number
  effect: number
  speed: number
}

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

export type WeatherState = {
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

export type IotvexNode = {
  host: string
  node_id: number
  /** HELLO kind: 0=light strips, 1=opaque STATE. */
  kind: number
  strip_count: number
  strips: StripState[]
  weather: WeatherState | null
  sensors: WeatherSensorReading[]
  ts: number
}

export type IotvexNodesPayload = {
  nodes: IotvexNode[]
}
