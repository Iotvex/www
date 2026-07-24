/**
 * Execute assistant intents against the same home APIs the website uses.
 */

import { createAdminClient } from "@/shared/lib/supabase/admin"
import { runHomeAction, runHomeActions } from "@/shared/lib/home/actions"
import { getAutomation, getScene, getScript, markAutomationTriggered, touchScript } from "@/shared/lib/home/catalog"
import { logEvent } from "@/shared/lib/home/events"
import {
  decodeAgentNodes,
  lightStripEntityId,
  MSG,
  packSetStripPayload,
  type AgentOpaqueNode,
  type ProtoStrip,
} from "@/shared/lib/iotvex-proto"
import { defaultStripName } from "@/shared/lib/home/action-options"
import type { AssistantEntities, AssistantIntentName, ParsedIntent } from "./nlu"

const AGENT = process.env.IOTVEX_AGENT_URL || "http://127.0.0.1:7421"

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

export type ActionResult = {
  action: string
  success: boolean
  detail?: string
  data?: unknown
}

type StripRow = {
  id: string
  name: string
  index: number
  node_id: number
  on: boolean
  brightness: number
  r: number
  g: number
  b: number
  effect: number
  speed: number
}

async function listStrips(): Promise<StripRow[]> {
  const listRes = await fetch(`${AGENT}/nodes`, {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  })
  if (!listRes.ok) throw new Error(`agent nodes ${listRes.status}`)
  const body = (await listRes.json()) as { nodes?: AgentOpaqueNode[] }
  const nodes = decodeAgentNodes(body.nodes || [])
  const strips: StripRow[] = []
  for (const node of nodes) {
    if (!node.strips?.length) continue
    node.strips.forEach((s, idx) => {
      const index = Number.isFinite(s.index) ? Number(s.index) : idx
      strips.push({
        id: lightStripEntityId(node.node_id, index),
        name: defaultStripName(index),
        index,
        node_id: node.node_id,
        on: Boolean(s.on),
        brightness: Number(s.brightness ?? 255),
        r: Number(s.r ?? 255),
        g: Number(s.g ?? 255),
        b: Number(s.b ?? 255),
        effect: Number(s.effect ?? 0),
        speed: Number(s.speed ?? 128),
      })
    })
  }
  return strips
}

function pickStrips(strips: StripRow[], target?: string, targetIndex?: number): StripRow[] {
  if (!strips.length) return []

  if (targetIndex != null && Number.isFinite(targetIndex)) {
    const byIdx = strips.filter((s) => s.index === targetIndex)
    if (byIdx.length) return byIdx
    if (targetIndex >= 0 && targetIndex < strips.length) return [strips[targetIndex]]
  }

  const t = (target || "all").toLowerCase().trim()
  if (!t || t === "all" || t === "lights") return strips

  const stripMatch = t.match(/^strip:(\d+)$/)
  if (stripMatch) {
    const idx = Number(stripMatch[1])
    const byIdx = strips.filter((s) => s.index === idx)
    if (byIdx.length) return byIdx
    if (idx >= 0 && idx < strips.length) return [strips[idx]]
  }

  if (t === "left" || t === "first" || t === "1") {
    const hit = strips.filter((s) => s.index === 0 || /left|лев/i.test(s.name))
    return hit.length ? hit : strips.slice(0, 1)
  }
  if (t === "right" || t === "second" || t === "2") {
    const hit = strips.filter((s) => s.index === 1 || /right|прав/i.test(s.name))
    return hit.length ? hit : strips.slice(1, 2)
  }

  const fuzzy = strips.filter((s) => {
    const blob = `${s.name} ${s.id}`.toLowerCase()
    return blob.includes(t) || t.includes(blob)
  })
  return fuzzy.length ? fuzzy : strips
}

function pctToByte(pct: number) {
  return Math.max(0, Math.min(255, Math.round((pct / 100) * 255)))
}

async function controlStrip(
  strip: StripRow,
  patch: Partial<ProtoStrip>,
): Promise<ActionResult> {
  const body: ProtoStrip = {
    index: strip.index,
    on: patch.on ?? strip.on,
    brightness: patch.brightness ?? strip.brightness,
    r: patch.r ?? strip.r,
    g: patch.g ?? strip.g,
    b: patch.b ?? strip.b,
    effect: patch.effect ?? strip.effect,
    speed: patch.speed ?? strip.speed,
  }
  const res = await fetch(`${AGENT}/node/${strip.node_id}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      msg_type: MSG.SET_STRIP,
      payload_b64: packSetStripPayload(body),
      need_ack: false,
    }),
  })
  // Keep local snapshot coherent for multi-strip loops
  Object.assign(strip, body)
  return {
    action: "set_strip",
    success: res.ok,
    detail: strip.name,
    data: { status: res.status, strip: body },
  }
}

function fuzzyFind<T extends { id: string; name: string }>(
  items: T[],
  query: string | undefined,
): T | null {
  if (!items.length) return null
  if (!query) return items[0]
  const q = query.toLowerCase().trim()
  const exact = items.find((i) => i.name.toLowerCase() === q || i.id.toLowerCase() === q)
  if (exact) return exact
  const partial = items.find(
    (i) => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase()),
  )
  if (partial) return partial
  // token overlap
  const qTokens = q.split(/\s+/).filter(Boolean)
  let best: T | null = null
  let bestScore = 0
  for (const item of items) {
    const name = item.name.toLowerCase()
    const score = qTokens.filter((tok) => name.includes(tok)).length
    if (score > bestScore) {
      bestScore = score
      best = item
    }
  }
  return bestScore > 0 ? best : null
}

export async function executeAssistantIntent(intent: ParsedIntent): Promise<{
  ok: boolean
  detail?: string
  actions: ActionResult[]
}> {
  const name = intent.name
  const ent = intent.entities

  if (
    name === "greeting" ||
    name === "help" ||
    name === "status" ||
    name === "unknown"
  ) {
    return { ok: true, actions: [], detail: name }
  }

  try {
    if (
      name === "lights_on" ||
      name === "lights_off" ||
      name === "toggle" ||
      name === "set_brightness" ||
      name === "set_color" ||
      name === "set_effect" ||
      name === "set_speed"
    ) {
      const strips = pickStrips(await listStrips(), ent.target, ent.target_index)
      if (!strips.length) return { ok: false, detail: "no_strips", actions: [] }

      // Compound: apply color + brightness + effect + speed in one SET_STRIP when present.
      const actions = await Promise.all(
        strips.map(async (strip) => {
          if (name === "lights_off") {
            return controlStrip(strip, { on: false })
          }
          if (name === "toggle" && !ent.color_hex && ent.brightness == null && !ent.effect) {
            return controlStrip(strip, { on: !strip.on })
          }

          const patch: Partial<ProtoStrip> = { on: true }

          if (name === "lights_on") {
            patch.on = true
          }

          if (ent.brightness != null || ent.relative != null) {
            let pct = ent.brightness
            if (pct == null && ent.relative != null) {
              pct = Math.max(
                0,
                Math.min(100, Math.round((strip.brightness / 255) * 100) + ent.relative),
              )
            }
            if (pct != null) patch.brightness = pctToByte(pct)
          } else if (name === "set_brightness") {
            return {
              action: "set_brightness",
              success: false,
              detail: "missing_brightness",
            } satisfies ActionResult
          }

          if (ent.color_hex) {
            const hex = ent.color_hex.replace("#", "")
            patch.r = parseInt(hex.slice(0, 2), 16)
            patch.g = parseInt(hex.slice(2, 4), 16)
            patch.b = parseInt(hex.slice(4, 6), 16)
            // Color implies solid unless a non-solid effect was also asked
            if (!ent.effect || ent.effect === "solid") patch.effect = 0
          }

          if (ent.effect) {
            patch.effect = EFFECT_NAME_TO_ID[ent.effect] ?? 1
          }

          if (ent.speed != null) {
            patch.speed = pctToByte(ent.speed)
          }

          // Pure power on with no other fields
          if (
            name === "lights_on" &&
            ent.brightness == null &&
            ent.relative == null &&
            !ent.color_hex &&
            !ent.effect &&
            ent.speed == null
          ) {
            return controlStrip(strip, { on: true })
          }

          return controlStrip(strip, patch)
        }),
      )
      const ok = actions.length > 0 && actions.every((a) => a.success)
      const failed = actions.filter((a) => !a.success)
      return {
        ok,
        detail: ok
          ? actions.map((a) => a.detail).filter(Boolean).join(", ")
          : failed.map((a) => a.detail || "failed").join(", ") || "command_failed",
        actions,
      }
    }

    const sb = createAdminClient()

    if (name === "activate_scene") {
      const { data } = await sb.from("scenes").select("id,name").order("name")
      const scene = fuzzyFind((data || []) as { id: string; name: string }[], ent.scene_query)
      if (!scene) return { ok: false, detail: "scene_not_found", actions: [] }
      const full = await getScene(scene.id)
      const results = []
      for (const [entityId, desired] of Object.entries(full.entities || {})) {
        const d = (desired || {}) as Record<string, unknown>
        results.push(
          await runHomeAction({
            action: d.state === "off" ? "light.turn_off" : "light.turn_on",
            target: { entity_id: entityId },
            data: d,
          }),
        )
      }
      await logEvent({ kind: "scene.activate", title: `Сцена «${scene.name}»`, detail: scene.id })
      return {
        ok: true,
        detail: scene.name,
        actions: [{ action: "activate_scene", success: true, detail: scene.name, data: results }],
      }
    }

    if (name === "run_automation") {
      const { data } = await sb.from("automations").select("id,name").order("name")
      const autoMeta = fuzzyFind(
        (data || []) as { id: string; name: string }[],
        ent.automation_query,
      )
      if (!autoMeta) return { ok: false, detail: "automation_not_found", actions: [] }
      const auto = await getAutomation(autoMeta.id)
      const results = await runHomeActions(auto.actions || [])
      await markAutomationTriggered(auto.id)
      await logEvent({
        kind: "automation.run",
        title: `Автоматизация «${auto.name}»`,
        detail: auto.id,
      })
      return {
        ok: true,
        detail: auto.name,
        actions: [{ action: "run_automation", success: true, detail: auto.name, data: results }],
      }
    }

    if (name === "run_script") {
      const { data } = await sb.from("scripts").select("id,name").order("name")
      const scriptMeta = fuzzyFind(
        (data || []) as { id: string; name: string }[],
        ent.script_query,
      )
      if (!scriptMeta) return { ok: false, detail: "script_not_found", actions: [] }
      const script = await getScript(scriptMeta.id)
      const results = await runHomeActions(script.sequence || [])
      await touchScript(scriptMeta.id)
      await logEvent({ kind: "script.run", title: `Скрипт «${script.name}»`, detail: script.id })
      return {
        ok: true,
        detail: script.name,
        actions: [{ action: "run_script", success: true, detail: script.name, data: results }],
      }
    }

    return { ok: false, detail: `unsupported:${name}`, actions: [] }
  } catch (e) {
    return { ok: false, detail: String(e), actions: [{ action: name, success: false, detail: String(e) }] }
  }
}

export async function assistantStatusProbe(): Promise<{
  agent: boolean
  strips: number
}> {
  try {
    const strips = await listStrips()
    return { agent: true, strips: strips.length }
  } catch {
    try {
      const res = await fetch(`${AGENT}/health`, { signal: AbortSignal.timeout(1500) })
      return { agent: res.ok, strips: 0 }
    } catch {
      return { agent: false, strips: 0 }
    }
  }
}

export type { AssistantIntentName, AssistantEntities }
