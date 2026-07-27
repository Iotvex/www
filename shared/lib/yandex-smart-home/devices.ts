/**
 * Yandex Smart Home device mapping from IoTVex catalog entities.
 * Protocol: https://yandex.ru/dev/dialogs/smart-home/doc/ru/reference/resources
 */

import type { DbArea, DbDevice, DbEntity, DbEntityState } from "@/shared/lib/home/types"
import { LED_BRIGHTNESS_CAP, YANDEX_USER_ID } from "./config"

export type CatalogSnapshot = {
  areas: DbArea[]
  devices: DbDevice[]
  entities: DbEntity[]
  states: DbEntityState[]
}

type YandexCapability = Record<string, unknown>
type YandexProperty = Record<string, unknown>

export type YandexDevice = {
  id: string
  name: string
  description?: string
  room?: string
  type: string
  /** Required by Yandex discovery schema — rejection without it. */
  status_info: {
    reportable: boolean
  }
  custom_data?: Record<string, unknown>
  capabilities?: YandexCapability[]
  properties?: YandexProperty[]
  device_info?: {
    manufacturer: string
    model: string
    hw_version?: string
    sw_version?: string
  }
}

const RU_NAMES: Record<string, string> = {
  "Left Strip": "Левая лента",
  "Right Strip": "Правая лента",
  "Living Room Weather": "Метеостанция",
  Temperature: "Температура",
  Humidity: "Влажность",
  Illuminance: "Освещённость",
  Pressure: "Давление",
  "CO₂": "CO₂",
  "Living Room": "Гостиная",
  "Living Room Light": "Свет гостиной",
}

function ruName(name: string): string {
  return RU_NAMES[name] || name
}

function areaName(areas: DbArea[], areaId: string | null | undefined): string | undefined {
  if (!areaId) return undefined
  const a = areas.find((x) => x.id === areaId)
  return a ? ruName(a.name) : areaId
}

function stateFor(states: DbEntityState[], entityId: string): DbEntityState | undefined {
  return states.find((s) => s.entity_id === entityId)
}

function numState(st: DbEntityState | undefined): number | null {
  if (!st) return null
  const n = Number(st.state)
  return Number.isFinite(n) ? n : null
}

function briPctFromWire(bri: number): number {
  const capped = Math.min(Math.max(0, bri), LED_BRIGHTNESS_CAP)
  return Math.round((capped / 255) * 100)
}

function rgbToInt(r: number, g: number, b: number): number {
  return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255)
}

function intToRgb(v: number): [number, number, number] {
  const n = Math.max(0, Math.min(0xffffff, Math.trunc(v)))
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** hPa → mmHg for Yandex pressure unit. */
function hpaToMmhg(hpa: number): number {
  return Math.round(hpa * 0.750061683 * 10) / 10
}

function weatherDeviceId(device: DbDevice): string {
  // Stable group id (not individual sensor.* entities).
  return `sensor.${(device.external_id || device.id).toString().replace(/\W+/g, "_")}_station`.replace(
    /sensor\.\d+_station/,
    "sensor.living_room_weather",
  )
}

function knownWeatherId(device: DbDevice): string {
  if (device.model === "living-room-weather-station") return "sensor.living_room_weather"
  return weatherDeviceId(device)
}

export function buildDiscoveryDevices(catalog: CatalogSnapshot): YandexDevice[] {
  const out: YandexDevice[] = []
  const { areas, devices, entities } = catalog

  for (const ent of entities) {
    if (!ent.enabled) continue
    if (ent.domain !== "light") continue
    const room = areaName(areas, ent.area_id)
    const attrs = ent.attributes || {}
    const caps: YandexCapability[] = [
      {
        type: "devices.capabilities.on_off",
        retrievable: true,
        reportable: false,
      },
    ]
    if (ent.capabilities.includes("brightness")) {
      // Docs/examples use min 1 for lights; actions still clamp to LED_BRIGHTNESS_CAP (~70%).
      caps.push({
        type: "devices.capabilities.range",
        retrievable: true,
        reportable: false,
        parameters: {
          instance: "brightness",
          random_access: true,
          unit: "unit.percent",
          range: { min: 1, max: 100, precision: 1 },
        },
      })
    }
    if (ent.capabilities.includes("color")) {
      caps.push({
        type: "devices.capabilities.color_setting",
        retrievable: true,
        reportable: false,
        parameters: {
          color_model: "rgb",
        },
      })
    }
    const dev = devices.find((d) => d.id === ent.device_id)
    out.push({
      id: ent.id,
      name: ruName(ent.name),
      description: "LED лента",
      room,
      type: "devices.types.light.strip",
      status_info: { reportable: false },
      custom_data: {
        entity_id: ent.id,
        kind: "light",
        strip_index: Number(attrs.strip_index ?? 0),
      },
      capabilities: caps,
      device_info: {
        manufacturer: "Iotvex",
        model: String(dev?.model || "led-strip"),
        sw_version: "1.0",
      },
    })
  }

  // Group weather sensors into one Yandex sensor device (better voice UX).
  const weatherDevices = devices.filter(
    (d) => d.platform === "iotvex" && (d.model || "").includes("weather"),
  )
  for (const device of weatherDevices) {
    const sensors = entities.filter(
      (e) => e.enabled && e.domain === "sensor" && e.device_id === device.id,
    )
    if (!sensors.length) continue
    const props: YandexProperty[] = []
    for (const s of sensors) {
      const cls = String(s.attributes?.device_class || s.attributes?.sensor_key || "")
      if (cls === "temperature" || s.attributes?.sensor_key === "temperature") {
        props.push({
          type: "devices.properties.float",
          retrievable: true,
          reportable: false,
          parameters: { instance: "temperature", unit: "unit.temperature.celsius" },
        })
      } else if (cls === "humidity" || s.attributes?.sensor_key === "humidity") {
        props.push({
          type: "devices.properties.float",
          retrievable: true,
          reportable: false,
          parameters: { instance: "humidity", unit: "unit.percent" },
        })
      } else if (cls === "carbon_dioxide" || s.attributes?.sensor_key === "co2") {
        props.push({
          type: "devices.properties.float",
          retrievable: true,
          reportable: false,
          parameters: { instance: "co2_level", unit: "unit.ppm" },
        })
      } else if (cls === "illuminance" || s.attributes?.sensor_key === "illuminance") {
        props.push({
          type: "devices.properties.float",
          retrievable: true,
          reportable: false,
          parameters: { instance: "illumination", unit: "unit.illumination.lux" },
        })
      } else if (cls === "pressure" || s.attributes?.sensor_key === "pressure") {
        props.push({
          type: "devices.properties.float",
          retrievable: true,
          reportable: false,
          parameters: { instance: "pressure", unit: "unit.pressure.mmhg" },
        })
      }
    }
    if (!props.length) continue
    out.push({
      id: knownWeatherId(device),
      name: ruName(device.name),
      description: "Метеостанция",
      room: areaName(areas, device.area_id),
      type: "devices.types.sensor.climate",
      status_info: { reportable: false },
      custom_data: {
        kind: "weather",
        device_id: device.id,
        entity_ids: sensors.map((s) => s.id).join(","),
      },
      properties: props,
      device_info: {
        manufacturer: "Iotvex",
        model: String(device.model || "weather-station"),
        sw_version: "1.0",
      },
    })
  }

  return out
}

export function buildQueryStates(
  catalog: CatalogSnapshot,
  deviceIds: string[],
): Array<Record<string, unknown>> {
  const discovery = buildDiscoveryDevices(catalog)
  const wanted = deviceIds.length
    ? discovery.filter((d) => deviceIds.includes(d.id))
    : discovery

  return wanted.map((dev) => {
    const kind = String(dev.custom_data?.kind || "")
    if (kind === "light") {
      const entityId = String(dev.custom_data?.entity_id || dev.id)
      const st = stateFor(catalog.states, entityId)
      const on = (st?.state || "off") === "on"
      const attrs = (st?.attributes || {}) as Record<string, unknown>
      const bri = Number(attrs.brightness ?? 128)
      const rgb = Array.isArray(attrs.rgb_color)
        ? (attrs.rgb_color as number[])
        : [255, 255, 255]
      const caps: YandexCapability[] = [
        {
          type: "devices.capabilities.on_off",
          state: { instance: "on", value: on },
        },
      ]
      if (dev.capabilities?.some((c) => c.type === "devices.capabilities.range")) {
        caps.push({
          type: "devices.capabilities.range",
          state: { instance: "brightness", value: briPctFromWire(bri) },
        })
      }
      if (dev.capabilities?.some((c) => c.type === "devices.capabilities.color_setting")) {
        caps.push({
          type: "devices.capabilities.color_setting",
          state: {
            instance: "rgb",
            value: rgbToInt(Number(rgb[0] ?? 255), Number(rgb[1] ?? 255), Number(rgb[2] ?? 255)),
          },
        })
      }
      return {
        id: dev.id,
        capabilities: caps,
        ...(st && st.available === false
          ? { error_code: "DEVICE_UNREACHABLE", error_message: "offline" }
          : {}),
      }
    }

    // weather group (entity_ids may be string[] or comma-joined string from discovery)
    const rawIds = dev.custom_data?.entity_ids
    const entityIds = Array.isArray(rawIds)
      ? (rawIds as string[])
      : String(rawIds || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
    const props: YandexProperty[] = []
    for (const eid of entityIds) {
      const ent = catalog.entities.find((e) => e.id === eid)
      const st = stateFor(catalog.states, eid)
      const n = numState(st)
      if (!ent || n == null) continue
      const key = String(ent.attributes?.sensor_key || ent.attributes?.device_class || "")
      if (key === "temperature") {
        props.push({
          type: "devices.properties.float",
          state: { instance: "temperature", value: Math.round(n * 10) / 10 },
        })
      } else if (key === "humidity") {
        props.push({
          type: "devices.properties.float",
          state: { instance: "humidity", value: Math.round(n) },
        })
      } else if (key === "co2" || key === "carbon_dioxide") {
        props.push({
          type: "devices.properties.float",
          state: { instance: "co2_level", value: Math.round(n) },
        })
      } else if (key === "illuminance") {
        props.push({
          type: "devices.properties.float",
          state: { instance: "illumination", value: Math.max(0, Math.round(n)) },
        })
      } else if (key === "pressure") {
        props.push({
          type: "devices.properties.float",
          state: { instance: "pressure", value: hpaToMmhg(n) },
        })
      }
    }
    return { id: dev.id, properties: props }
  })
}

export function requestIdOf(req: Request): string {
  return (
    req.headers.get("x-request-id") ||
    req.headers.get("X-Request-Id") ||
    randomRequestId()
  )
}

function randomRequestId(): string {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`
}

/**
 * Build discovery payload.
 * YANDEX_DISCOVERY_MINIMAL=1 → single light only (schema triage when Quasar rejects full list).
 */
export function discoveryPayload(catalog: CatalogSnapshot) {
  let devices = buildDiscoveryDevices(catalog)
  if ((process.env.YANDEX_DISCOVERY_MINIMAL || "").trim() === "1") {
    // Absolute minimum Quasar accepts: one light, on_off only.
    const one =
      devices.find((d) => d.type.startsWith("devices.types.light")) || devices[0]
    devices = one
      ? [
          {
            id: one.id,
            name: one.name,
            room: one.room || "Гостиная",
            type: "devices.types.light",
            status_info: { reportable: false },
            capabilities: [
              {
                type: "devices.capabilities.on_off",
                retrievable: true,
                reportable: false,
              },
            ],
            device_info: {
              manufacturer: "Iotvex",
              model: "led-strip",
              sw_version: "1.0",
            },
            custom_data: {
              entity_id: String(one.custom_data?.entity_id || one.id),
              kind: "light",
            },
          },
        ]
      : []
  }
  return {
    user_id: YANDEX_USER_ID,
    devices,
  }
}

export { intToRgb, briPctFromWire }
