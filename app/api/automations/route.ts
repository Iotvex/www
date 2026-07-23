
import { NextResponse } from "next/server"
import {
  listAutomations,
  summarizeAction,
  summarizeTrigger,
  upsertAutomation,
} from "@/shared/lib/home/catalog"
import { logEvent } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await listAutomations()
    const items = rows.map((a) => ({
      ...a,
      entity_id: `automation.${a.id}`,
      state: a.enabled ? "on" : "off",
      trigger_label: summarizeTrigger(a.trigger || {}),
      action_label: summarizeAction(a.actions || []),
      source: "supabase",
    }))
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: String(e), items: [] }, { status: 502 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const id = String(body.id || `auto_${Date.now()}`)
    const name = String(body.name || "").trim()
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })
    const row = await upsertAutomation({
      id,
      name,
      description: body.description || "",
      enabled: body.enabled !== false,
      trigger: body.trigger || { trigger: "time", at: "17:00:00" },
      conditions: body.conditions || [],
      actions: body.actions || [],
      mode: body.mode || "single",
    })
    await logEvent({ kind: "automation.save", title: `Автоматизация «${name}»`, detail: id })
    return NextResponse.json({ item: row })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
