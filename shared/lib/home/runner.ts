/**
 * Home automation scheduler (device-plane adjacent).
 *
 * Config (triggers/actions) lives in Supabase (local or user remote).
 * Evaluation ALWAYS runs on the home machine — typically via:
 *   systemd iotvex-automations.timer
 *     → POST http://127.0.0.1:80/api/cron/automations
 *     → tickAutomations() → IOTVEX_AGENT_URL (local) → Thread
 *
 * Durable mode (complete_to_end, default true):
 *   missed/failed runs are ledgered in automation_runs and retried with backoff
 *   until success or the catch-up grace window expires (power loss / lag recovery).
 *
 * Do not schedule ticks against a public www URL. LAN/published UI only edits DB.
 */
import {
  ensureAutomationRun,
  listAutomations,
  listOpenAutomationRuns,
  markAutomationTriggered,
  syncAgentStates,
  updateAutomationRun,
} from "@/shared/lib/home/catalog"
import { runHomeActions } from "@/shared/lib/home/actions"
import { createAdminClient } from "@/shared/lib/supabase/admin"
import type { DbAutomation, DbAutomationRun } from "@/shared/lib/home/types"

const DEBOUNCE_MS = 50_000
const RETRY_BASE_MS = 30_000
const RETRY_MAX_MS = 15 * 60_000
const CATCHUP_GRACE_MS = 6 * 60 * 60_000
const MAX_RUNS_PER_TICK = 20
const STALE_RUNNING_MS = RETRY_MAX_MS

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

function homeDateKey(date: Date, tz = homeTimezone()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  return fmt.format(date)
}

/** Convert a civil date+HH:MM in `timeZone` to a UTC Date. */
function zonedLocalToUtc(dateKey: string, hhmm: string, timeZone: string): Date {
  const want = `${dateKey}T${hhmm.length >= 5 ? hhmm.slice(0, 5) : hhmm}:00`
  let guess = Date.parse(`${want}Z`)
  if (!Number.isFinite(guess)) guess = Date.now()

  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(guess))
    const get = (type: string) => parts.find((p) => p.type === type)?.value || "00"
    const hourRaw = get("hour")
    const hour = hourRaw === "24" ? "00" : hourRaw
    const asLocal = `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}`
    const delta = Date.parse(`${want}Z`) - Date.parse(`${asLocal}Z`)
    if (!Number.isFinite(delta) || Math.abs(delta) < 500) break
    guess += delta
  }
  return new Date(guess)
}

function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(dt.getUTCDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

function isCompleteToEnd(auto: DbAutomation): boolean {
  return auto.complete_to_end !== false
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
  recentEvents: Array<{ kind?: string; entity_id?: string | null; created_at?: string }>,
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
    if (trigger.from != null && String(trigger.from) !== "") {
      const prev = String(st.attributes?.previous_state ?? "")
      if (prev !== String(trigger.from)) return false
    }
    if (trigger.to != null && String(trigger.to) !== "" && String(st.state) !== String(trigger.to)) {
      return false
    }
    if (trigger.attribute != null && trigger.to != null) {
      const attr = String(trigger.attribute)
      if (String(st.attributes?.[attr]) !== String(trigger.to)) return false
    }
    return true
  }

  if (kind === "event") {
    const wantKind = String(trigger.event_type || trigger.event || trigger.kind || "").trim()
    if (!wantKind) return false
    const wantEntity = String(trigger.entity_id || "").trim()
    const windowMs = Number(trigger.window_ms || 70_000)
    const cutoff = Date.now() - (Number.isFinite(windowMs) ? windowMs : 70_000)
    return recentEvents.some((ev) => {
      const ek = String(ev.kind || "")
      if (ek !== wantKind && !ek.startsWith(wantKind)) return false
      if (wantEntity && String(ev.entity_id || "") !== wantEntity) return false
      const t = ev.created_at ? new Date(ev.created_at).getTime() : 0
      return Number.isFinite(t) && t >= cutoff
    })
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

function actionsSucceeded(results: unknown[]): boolean {
  if (!Array.isArray(results) || results.length === 0) return true
  return results.every((item) => {
    if (!item || typeof item !== "object") return true
    const row = item as { ok?: boolean; skipped?: boolean }
    if (row.skipped) return true
    return row.ok !== false
  })
}

function summarizeActionErrors(results: unknown[]): string {
  return results
    .map((item, index) => {
      if (!item || typeof item !== "object") return null
      const row = item as { ok?: boolean; skipped?: boolean; error?: string; reason?: string }
      if (row.skipped || row.ok !== false) return null
      return `#${index}: ${row.error || row.reason || "failed"}`
    })
    .filter(Boolean)
    .join("; ")
    .slice(0, 2000)
}

function retryDelayMs(attempts: number): number {
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, Math.max(0, attempts - 1)))
}

function canRetry(run: DbAutomationRun, nowMs: number): boolean {
  if (run.status === "pending") return true
  if (run.status !== "failed") return false
  const base = run.last_attempt_at || run.updated_at || run.created_at
  const last = Date.parse(base)
  if (!Number.isFinite(last)) return true
  return nowMs - last >= retryDelayMs(run.attempts || 1)
}

function timeSlotCandidates(
  trigger: Record<string, unknown>,
  nowMs: number,
  tz: string,
): Date[] {
  const at = String(trigger.at || trigger.time || "")
  const hhmm = at.length === 5 ? at : at.slice(0, 5)
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return []

  const todayKey = homeDateKey(new Date(nowMs), tz)
  const keys = [todayKey, shiftDateKey(todayKey, -1)]
  const out: Date[] = []
  for (const key of keys) {
    const when = zonedLocalToUtc(key, hhmm, tz)
    const t = when.getTime()
    if (!Number.isFinite(t)) continue
    if (t > nowMs) continue
    if (nowMs - t > CATCHUP_GRACE_MS) continue
    out.push(when)
  }
  return out
}

function weekdayAllowed(trigger: Record<string, unknown>, when: Date, tz: string): boolean {
  const days = trigger.weekday
  if (!Array.isArray(days) || days.length === 0) return true
  const parts = tzNowPartsFor(when, tz)
  return days.map(String).includes(parts.weekday)
}

function tzNowPartsFor(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  const weekdayMap: Record<string, string> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
    Sun: "sun",
  }
  return {
    hhmm: `${parts.hour}:${parts.minute}`,
    weekday: weekdayMap[parts.weekday] || "",
  }
}

async function enqueueDurableSlot(automationId: string, scheduledFor: Date) {
  return ensureAutomationRun(automationId, scheduledFor)
}

async function executeDurableRun(params: {
  run: DbAutomationRun
  auto: DbAutomation
  now: { hhmm: string; weekday: string }
  states: Map<string, { state: string; attributes: Record<string, unknown>; last_changed: string }>
}): Promise<"succeeded" | "failed"> {
  const { run, auto, now, states } = params
  const nowIso = new Date().toISOString()
  await updateAutomationRun(run.id, {
    status: "running",
    attempts: (run.attempts || 0) + 1,
    last_attempt_at: nowIso,
    last_error: null,
  })

  try {
    if (!conditionsPass((auto.conditions || []) as unknown[], now, states)) {
      await updateAutomationRun(run.id, {
        status: "failed",
        last_error: "Conditions not met; will retry",
      })
      return "failed"
    }

    const results = await runHomeActions(auto.actions || [])
    if (!actionsSucceeded(results)) {
      await updateAutomationRun(run.id, {
        status: "failed",
        last_error: summarizeActionErrors(results) || "Action failed",
      })
      return "failed"
    }

    await updateAutomationRun(run.id, {
      status: "succeeded",
      completed_at: nowIso,
      last_error: null,
    })
    await markAutomationTriggered(auto.id)
    return "succeeded"
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation run failed"
    await updateAutomationRun(run.id, {
      status: "failed",
      last_error: message.slice(0, 2000),
    })
    return "failed"
  }
}

async function processDurableQueue(params: {
  autos: DbAutomation[]
  now: { hhmm: string; weekday: string; ts: number; tz: string }
  states: Map<string, { state: string; attributes: Record<string, unknown>; last_changed: string }>
}) {
  const { autos, now, states } = params
  const byId = new Map(autos.map((a) => [a.id, a]))
  const openRuns = await listOpenAutomationRuns()
  const nowMs = now.ts
  const nowIso = new Date(nowMs).toISOString()

  let abandoned = 0
  const actionable: DbAutomationRun[] = []

  for (const run of openRuns) {
    const auto = byId.get(run.automation_id)
    if (!auto || !auto.enabled || !isCompleteToEnd(auto)) {
      await updateAutomationRun(run.id, {
        status: "abandoned",
        completed_at: nowIso,
        last_error: "Automation disabled or complete_to_end is off",
      })
      abandoned += 1
      continue
    }

    const scheduledMs = Date.parse(run.scheduled_for)
    if (Number.isFinite(scheduledMs) && nowMs - scheduledMs > CATCHUP_GRACE_MS) {
      await updateAutomationRun(run.id, {
        status: "abandoned",
        completed_at: nowIso,
        last_error: "Catch-up grace window exceeded",
      })
      abandoned += 1
      continue
    }

    if (run.status === "running") {
      const started = Date.parse(run.last_attempt_at || run.updated_at || run.created_at)
      if (!Number.isFinite(started) || nowMs - started > STALE_RUNNING_MS) {
        const failed = await updateAutomationRun(run.id, {
          status: "failed",
          last_error: run.last_error || "Interrupted while running",
        })
        if (canRetry(failed, nowMs)) actionable.push(failed)
      }
      continue
    }

    if (canRetry(run, nowMs)) actionable.push(run)
  }

  actionable.sort((a, b) => Date.parse(a.scheduled_for) - Date.parse(b.scheduled_for))

  let executed = 0
  let succeeded = 0
  let failed = 0
  const fired: Array<{ id: string; name: string; results?: unknown; durable?: boolean }> = []

  for (const run of actionable.slice(0, MAX_RUNS_PER_TICK)) {
    const auto = byId.get(run.automation_id)
    if (!auto) continue
    executed += 1
    const outcome = await executeDurableRun({ run, auto, now, states })
    if (outcome === "succeeded") {
      succeeded += 1
      fired.push({ id: auto.id, name: auto.name, durable: true })
    } else {
      failed += 1
    }
  }

  return { executed, succeeded, failed, abandoned, fired }
}

/** Evaluate enabled automations once (idempotent per minute via last_triggered / run ledger). */
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
  let recentEvents: Array<{ kind?: string; entity_id?: string | null; created_at?: string }> = []
  try {
    const sb = createAdminClient()
    const { data } = await sb
      .from("events")
      .select("kind, entity_id, created_at")
      .order("created_at", { ascending: false })
      .limit(80)
    recentEvents = (data || []) as typeof recentEvents
  } catch {
    recentEvents = []
  }

  const fired: Array<{ id: string; name: string; results?: unknown; durable?: boolean }> = []
  let durableEnqueued = 0

  // Catch-up: enqueue missed time slots after outages / lag (durable only)
  for (const auto of autos) {
    if (!auto.enabled || !isCompleteToEnd(auto)) continue
    const trigger = (auto.trigger || {}) as Record<string, unknown>
    const kind = String(trigger.trigger || trigger.platform || trigger.type || "")
    if (kind !== "time") continue
    for (const when of timeSlotCandidates(trigger, now.ts, now.tz)) {
      if (!weekdayAllowed(trigger, when, now.tz)) continue
      await enqueueDurableSlot(auto.id, when)
      durableEnqueued += 1
    }
  }

  for (const auto of autos) {
    if (!auto.enabled) continue
    const trigger = (auto.trigger || {}) as Record<string, unknown>
    if (!triggerMatches(trigger, now, states, recentEvents)) continue
    if (!conditionsPass((auto.conditions || []) as unknown[], now, states)) continue

    if (isCompleteToEnd(auto)) {
      const kind = String(trigger.trigger || trigger.platform || trigger.type || "")
      let slot: Date
      if (kind === "time") {
        const at = String(trigger.at || trigger.time || "")
        const hhmm = at.length === 5 ? at : at.slice(0, 5)
        slot = zonedLocalToUtc(homeDateKey(new Date(now.ts), now.tz), hhmm, now.tz)
      } else {
        // Edge triggers: one retryable slot per home-local minute
        const minute = zonedLocalToUtc(homeDateKey(new Date(now.ts), now.tz), now.hhmm, now.tz)
        slot = minute
      }
      await enqueueDurableSlot(auto.id, slot)
      durableEnqueued += 1
      continue
    }

    // Non-durable: classic fire-and-forget with debounce
    if (auto.last_triggered) {
      const last = new Date(auto.last_triggered)
      const diff = Date.now() - last.getTime()
      if (diff < DEBOUNCE_MS) continue
    }

    try {
      const results = await runHomeActions(auto.actions || [])
      if (!actionsSucceeded(results)) continue
      await markAutomationTriggered(auto.id)
      fired.push({ id: auto.id, name: auto.name, results })
    } catch {
      // keep ticking other automations
    }
  }

  const durable = await processDurableQueue({ autos, now, states })
  fired.push(...durable.fired)

  return {
    now,
    sync,
    fired,
    durable: {
      enqueued: durableEnqueued,
      executed: durable.executed,
      succeeded: durable.succeeded,
      failed: durable.failed,
      abandoned: durable.abandoned,
    },
    scheduler: "home-systemd" as const,
    dbMode: runtime.dbMode,
    timezone: runtime.timezone,
  }
}
