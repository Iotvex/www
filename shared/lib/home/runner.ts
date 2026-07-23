/**
 * Home automation scheduler (device-plane adjacent).
 *
 * Config (triggers/actions) lives in Supabase (local or user remote).
 * Evaluation ALWAYS runs on the home machine — typically via:
 *   systemd iotvex-automations.timer
 *     → POST http://127.0.0.1:3100/api/cron/automations
 *     → tickAutomations() → IOTVEX_AGENT_URL (local) → Thread
 *
 * Do not schedule ticks against a public www URL. LAN/published UI only edits DB.
 */
import {
  listAutomations,
  markAutomationTriggered,
  syncAgentStates,
} from "@/shared/lib/home/catalog"
import { runHomeActions } from "@/shared/lib/home/actions"
import { createAdminClient } from "@/shared/lib/supabase/admin"

/** Home timezone for time triggers — never assume Moscow. */
export function homeTimezone(): string {
  return (
    process.env.IOTVEX_TZ ||
    process.env.TZ ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC"
  )
}

function tzNowParts(tz = homeTimezone()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]))
  const hhmm = `${parts.hour}:${parts.minute}`
  const weekdayMap: Record<string, string> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
    Sun: "sun",
  }
  return { hhmm, weekday: weekdayMap[parts.weekday] || "", tz, ts: Date.now() }
}

async function loadStates() {
  const sb = createAdminClient()
  const { data, error } = await sb.from("entity_states").select("*")
  if (error) throw new Error(error.message)
  return (data || []) as Array<{
    entity_id: string
    state: string
    attributes: Record<string, unknown>
    last_changed: string
  }>
}

function readNumeric(
  state: { state: string; attributes: Record<string, unknown> },
  attribute?: string,
): number | null {
  if (attribute) {
    const v = state.attributes?.[attribute]
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(state.state)
  return Number.isFinite(n) ? n : null
}

function changedRecently(iso: string | undefined, windowMs = 70_000) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  return Date.now() - t < windowMs
}

function triggerMatches(
  trigger: Record<string, unknown>,
  now: { hhmm: string; weekday: string },
  states: Map<string, { state: string; attributes: Record<string, unknown>; last_changed: string }>,
): boolean {
  const kind = String(trigger.trigger || trigger.platform || trigger.type || "")

  if (kind === "time") {
    const at = String(trigger.at || trigger.time || "")
    const want = at.length === 5 ? at : at.slice(0, 5)
    if (want !== now.hhmm) return false
    const days = trigger.weekday
    if (Array.isArray(days) && days.length > 0) {
      return days.map(String).includes(now.weekday)
    }
    return true
  }

  if (kind === "state") {
    const entityId = String(trigger.entity_id || "")
    const st = states.get(entityId)
    if (!st) return false
    if (!changedRecently(st.last_changed)) return false
    if (trigger.from != null && String(trigger.from) !== "" && String(st.state) === String(trigger.from)) {
      // from is previous — we only have current; require to match and recent change
    }
    if (trigger.to != null && String(trigger.to) !== "" && String(st.state) !== String(trigger.to)) {
      return false
    }
    // attribute equality optional
    if (trigger.attribute != null && trigger.to != null) {
      const attr = String(trigger.attribute)
      if (String(st.attributes?.[attr]) !== String(trigger.to)) return false
    }
    return true
  }

  if (kind === "numeric_state") {
    const entityId = String(trigger.entity_id || "")
    const st = states.get(entityId)
    if (!st) return false
    if (!changedRecently(st.last_changed)) return false
    const n = readNumeric(st, trigger.attribute ? String(trigger.attribute) : undefined)
    if (n == null) return false
    if (trigger.above != null && !(n > Number(trigger.above))) return false
    if (trigger.below != null && !(n < Number(trigger.below))) return false
    return true
  }

  if (kind === "event") {
    // Reserved for future event-bus modules
    return false
  }

  return false
}

function conditionMatches(
  condition: Record<string, unknown>,
  now: { hhmm: string; weekday: string },
  states: Map<string, { state: string; attributes: Record<string, unknown>; last_changed: string }>,
): boolean {
  const kind = String(condition.condition || condition.type || "")

  if (kind === "and") {
    const list = Array.isArray(condition.conditions) ? condition.conditions : []
    return list.every((c) => conditionMatches((c || {}) as Record<string, unknown>, now, states))
  }
  if (kind === "or") {
    const list = Array.isArray(condition.conditions) ? condition.conditions : []
    return list.some((c) => conditionMatches((c || {}) as Record<string, unknown>, now, states))
  }
  if (kind === "not") {
    const nested = Array.isArray(condition.conditions) ? condition.conditions : []
    const inner = (nested[0] || condition.condition_obj || {}) as Record<string, unknown>
    return !conditionMatches(inner, now, states)
  }

  if (kind === "state") {
    const entityId = String(condition.entity_id || "")
    const st = states.get(entityId)
    if (!st) return false
    if (condition.state != null && String(st.state) !== String(condition.state)) return false
    if (condition.attribute != null) {
      const attr = String(condition.attribute)
      if (condition.state != null && String(st.attributes?.[attr]) !== String(condition.state)) return false
    }
    return true
  }

  if (kind === "numeric_state") {
    const entityId = String(condition.entity_id || "")
    const st = states.get(entityId)
    if (!st) return false
    const n = readNumeric(st, condition.attribute ? String(condition.attribute) : undefined)
    if (n == null) return false
    if (condition.above != null && !(n > Number(condition.above))) return false
    if (condition.below != null && !(n < Number(condition.below))) return false
    return true
  }

  if (kind === "time") {
    const after = String(condition.after || "")
    const before = String(condition.before || "")
    const hhmm = now.hhmm
    if (after) {
      const a = after.length === 5 ? after : after.slice(0, 5)
      if (hhmm < a) return false
    }
    if (before) {
      const b = before.length === 5 ? before : before.slice(0, 5)
      if (hhmm > b) return false
    }
    const days = condition.weekday
    if (Array.isArray(days) && days.length > 0) {
      return days.map(String).includes(now.weekday)
    }
    return true
  }

  // Unknown condition types fail closed
  if (!kind) return true
  return false
}

function conditionsPass(
  conditions: unknown[],
  now: { hhmm: string; weekday: string },
  states: Map<string, { state: string; attributes: Record<string, unknown>; last_changed: string }>,
) {
  if (!conditions?.length) return true
  return conditions.every((c) => conditionMatches((c || {}) as Record<string, unknown>, now, states))
}

/** Evaluate enabled automations once (idempotent per minute via last_triggered). */
export async function tickAutomations() {
  const { getRuntimeConfig } = await import("@/shared/config/runtime.server")
  const { isLocalOrPrivateUrl } = await import("@/shared/config/runtime")
  const runtime = getRuntimeConfig()
  const agent = runtime.agentUrl
  if (!isLocalOrPrivateUrl(agent)) {
    console.warn(
      "[iotvex.automations] IOTVEX_AGENT_URL is not loopback/private — device plane must stay local:",
      agent,
    )
  }
  // Refresh entity_states from agent so state/numeric triggers can fire.
  // Soft-fail: time triggers still run if agent is briefly down.
  let sync: { entities?: string[]; error?: string; agent_warning?: string } = {}
  if (!isLocalOrPrivateUrl(agent)) {
    sync.agent_warning = "agent_url_not_local"
  }
  try {
    const result = await syncAgentStates(agent)
    sync = { entities: result.entities }
  } catch (e) {
    sync = { error: String(e) }
  }

  const autos = await listAutomations()
  const now = tzNowParts()
  const stateRows = await loadStates()
  const states = new Map(stateRows.map((s) => [s.entity_id, s]))
  const fired = []

  for (const auto of autos) {
    if (!auto.enabled) continue
    const trigger = (auto.trigger || {}) as Record<string, unknown>
    if (!triggerMatches(trigger, now, states)) continue
    if (!conditionsPass((auto.conditions || []) as unknown[], now, states)) continue

    if (auto.last_triggered) {
      const last = new Date(auto.last_triggered)
      const diff = Date.now() - last.getTime()
      if (diff < 50_000) continue
    }

    const results = await runHomeActions(auto.actions || [])
    await markAutomationTriggered(auto.id)
    fired.push({ id: auto.id, name: auto.name, results })
  }

  return {
    now,
    sync,
    fired,
    scheduler: "home-systemd" as const,
    dbMode: runtime.dbMode,
    timezone: runtime.timezone,
  }
}
