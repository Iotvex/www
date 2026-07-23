import { NextResponse } from "next/server"
import { createAdminClient } from "@/shared/lib/supabase/admin"
import { logEvent } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await request.json()
    const patch: Record<string, unknown> = {}
    if (body.title != null) patch.title = String(body.title)
    if (body.kind != null) patch.kind = String(body.kind)
    if (body.config != null) patch.config = body.config
    if (body.sort_order != null) patch.sort_order = Number(body.sort_order)
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 })
    }
    const sb = createAdminClient()
    if (patch.kind) {
      const { data: dup, error: dupErr } = await sb
        .from("dashboard_widgets")
        .select("id")
        .eq("kind", String(patch.kind))
        .neq("id", id)
        .limit(1)
      if (dupErr) throw new Error(dupErr.message)
      if (dup?.length) {
        return NextResponse.json({ error: "widget kind already exists" }, { status: 409 })
      }
    }
    const { data, error } = await sb
      .from("dashboard_widgets")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ item: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const sb = createAdminClient()
    const { error } = await sb.from("dashboard_widgets").delete().eq("id", id)
    if (error) throw new Error(error.message)
    await logEvent({ kind: "dashboard.delete", title: "Виджет удалён", detail: id })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
