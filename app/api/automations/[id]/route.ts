import { NextResponse } from "next/server"
import {
  deleteAutomation,
  setAutomationEnabled,
  upsertAutomation,
} from "@/shared/lib/home/catalog"
import { logEvent } from "@/shared/lib/home/events"
import { createAdminClient } from "@/shared/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await request.json()
    if (typeof body.enabled === "boolean" && Object.keys(body).length === 1) {
      const auto = await setAutomationEnabled(id, body.enabled)
      await logEvent({
        kind: "automation.toggle",
        title: auto.enabled ? "Автоматизация включена" : "Автоматизация выключена",
        detail: id,
      })
      return NextResponse.json({ ok: true, item: auto })
    }

    const sb = createAdminClient()
    const { data: existing, error } = await sb.from("automations").select("*").eq("id", id).single()
    if (error) throw new Error(error.message)
    const row = await upsertAutomation({
      id,
      name: body.name != null ? String(body.name) : existing.name,
      description: body.description != null ? String(body.description) : existing.description,
      enabled: typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
      trigger: body.trigger || existing.trigger,
      conditions: body.conditions != null ? body.conditions : existing.conditions,
      actions: body.actions != null ? body.actions : existing.actions,
      mode: body.mode || existing.mode,
    })
    await logEvent({ kind: "automation.save", title: `Автоматизация «${row.name}»`, detail: id })
    return NextResponse.json({ ok: true, item: row })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    await deleteAutomation(id)
    await logEvent({ kind: "automation.delete", title: "Автоматизация удалена", detail: id })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
