/**
 * Apply Yandex Smart Home actions to IoTVex lights via the strips API / agent.
 */

import {
  MSG,
  packSetStripPayload,
  type ProtoStrip,
} from "@/shared/lib/iotvex-proto"
import { agentFetch } from "@/shared/lib/agent-fetch"
import { loadHomeCatalog, upsertEntityState } from "@/shared/lib/home/catalog"
import { LED_BRIGHTNESS_CAP } from "./config"
import {
  type CatalogSnapshot,
  buildDiscoveryDevices,
  intToRgb,
} from "./devices"

type ActionCapability = {
  type: string
  state?: {
    instance?: string
    value?: unknown
    relative?: boolean
  }
}

function clampBriWire(pct: number): number {
  const p = Math.max(1, Math.min(70, Math.round(pct)))
  return Math.min(LED_BRIGHTNESS_CAP, Math.round((p / 100) * 255))
}

async function readStrip(
  catalog: CatalogSnapshot,
  entityId: string,
): Promise<{ strip: ProtoStrip; nodeId: number } | null> {
  const ent = catalog.entities.find((e) => e.id === entityId)
  if (!ent) return null
  const st = catalog.states.find((s) => s.entity_id === entityId)
  const attrs = { ...(ent.attributes || {}), ...(st?.attributes || {}) } as Record<
    string,
    unknown
  >
  const index = Number(attrs.strip_index ?? 0)
  const nodeId = Number(attrs.node_id)
  const rgb = Array.isArray(attrs.rgb_color)
    ? (attrs.rgb_color as number[])
    : [255, 255, 255]
  const strip: ProtoStrip = {
    index,
    on: (st?.state || "off") === "on",
    brightness: Number(attrs.brightness ?? 128),
    r: Number(rgb[0] ?? 255),
    g: Number(rgb[1] ?? 255),
    b: Number(rgb[2] ?? 255),
    effect: Number(attrs.effect ?? 0),
    speed: Number(attrs.speed ?? 128),
  }
  if (!Number.isFinite(nodeId) || nodeId <= 0) return null
  return { strip, nodeId }
}

async function applyStrip(nodeId: number, strip: ProtoStrip): Promise<boolean> {
  // Cap LED brightness ≤70%
  const capped: ProtoStrip = {
    ...strip,
    brightness: Math.min(strip.brightness, LED_BRIGHTNESS_CAP),
  }
  try {
    const res = await agentFetch(`/node/${nodeId}/command`, {
      method: "POST",
      signal: AbortSignal.timeout(2500),
      body: JSON.stringify({
        msg_type: MSG.SET_STRIP,
        payload_b64: packSetStripPayload(capped),
        need_ack: false,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function handleActions(
  devices: Array<{
    id: string
    custom_data?: Record<string, unknown>
    capabilities?: ActionCapability[]
  }>,
): Promise<Array<Record<string, unknown>>> {
  const catalog = (await loadHomeCatalog()) as CatalogSnapshot
  const discovery = buildDiscoveryDevices(catalog)
  const results: Array<Record<string, unknown>> = []

  for (const d of devices) {
    const meta = discovery.find((x) => x.id === d.id)
    const kind = String(meta?.custom_data?.kind || d.custom_data?.kind || "")
    if (kind !== "light") {
      results.push({
        id: d.id,
        action_result: {
          status: "ERROR",
          error_code: "INVALID_ACTION",
          error_message: "sensor is read-only",
        },
      })
      continue
    }

    const entityId = String(meta?.custom_data?.entity_id || d.custom_data?.entity_id || d.id)
    const current = await readStrip(catalog, entityId)
    if (!current) {
      results.push({
        id: d.id,
        action_result: {
          status: "ERROR",
          error_code: "DEVICE_UNREACHABLE",
          error_message: "unknown light",
        },
      })
      continue
    }

    const strip = { ...current.strip }
    const capResults: Array<Record<string, unknown>> = []
    let anyOk = false

    for (const cap of d.capabilities || []) {
      const instance = String(cap.state?.instance || "")
      try {
        if (cap.type === "devices.capabilities.on_off" && instance === "on") {
          strip.on = Boolean(cap.state?.value)
          if (strip.on && strip.brightness < 1) strip.brightness = Math.round(255 * 0.3)
        } else if (cap.type === "devices.capabilities.range" && instance === "brightness") {
          const raw = Number(cap.state?.value ?? 50)
          if (cap.state?.relative) {
            const curPct = Math.round((strip.brightness / 255) * 100)
            strip.brightness = clampBriWire(curPct + raw)
          } else {
            strip.brightness = clampBriWire(raw)
          }
          strip.on = true
        } else if (cap.type === "devices.capabilities.color_setting") {
          if (instance === "rgb") {
            const [r, g, b] = intToRgb(Number(cap.state?.value ?? 0xffffff))
            strip.r = r
            strip.g = g
            strip.b = b
            strip.on = true
          } else if (instance === "hsv" && cap.state?.value && typeof cap.state.value === "object") {
            const hsv = cap.state.value as { h?: number; s?: number; v?: number }
            const [r, g, b] = hsvToRgb(Number(hsv.h || 0), Number(hsv.s || 100), Number(hsv.v || 100))
            strip.r = r
            strip.g = g
            strip.b = b
            strip.on = true
          }
        }

        const ok = await applyStrip(current.nodeId, strip)
        // Prefer exact entity id for state upsert
        if (ok) {
          await upsertEntityState(
            entityId,
            strip.on ? "on" : "off",
            {
              brightness: Math.min(strip.brightness, LED_BRIGHTNESS_CAP),
              rgb_color: [strip.r, strip.g, strip.b],
              effect: strip.effect,
              speed: strip.speed,
            },
            true,
          ).catch(() => undefined)
        }
        anyOk = anyOk || ok
        capResults.push({
          type: cap.type,
          state: {
            instance,
            action_result: {
              status: ok ? "DONE" : "ERROR",
              ...(ok
                ? {}
                : {
                    error_code: "DEVICE_UNREACHABLE",
                    error_message: "agent command failed",
                  }),
            },
          },
        })
      } catch (e) {
        capResults.push({
          type: cap.type,
          state: {
            instance,
            action_result: {
              status: "ERROR",
              error_code: "INTERNAL_ERROR",
              error_message: String(e),
            },
          },
        })
      }
    }

    results.push({
      id: d.id,
      capabilities: capResults,
      ...(anyOk
        ? {}
        : {
            action_result: {
              status: "ERROR",
              error_code: "DEVICE_UNREACHABLE",
            },
          }),
    })
  }

  return results
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  // Yandex HSV: h 0–360, s/v 0–100
  const hh = ((h % 360) + 360) % 360
  const ss = Math.max(0, Math.min(100, s)) / 100
  const vv = Math.max(0, Math.min(100, v)) / 100
  const c = vv * ss
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = vv - c
  let rp = 0
  let gp = 0
  let bp = 0
  if (hh < 60) [rp, gp, bp] = [c, x, 0]
  else if (hh < 120) [rp, gp, bp] = [x, c, 0]
  else if (hh < 180) [rp, gp, bp] = [0, c, x]
  else if (hh < 240) [rp, gp, bp] = [0, x, c]
  else if (hh < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]
  return [
    Math.round((rp + m) * 255),
    Math.round((gp + m) * 255),
    Math.round((bp + m) * 255),
  ]
}
