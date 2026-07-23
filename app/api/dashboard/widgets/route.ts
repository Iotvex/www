import { NextResponse } from "next/server"
import { createAdminClient } from "@/shared/lib/supabase/admin"
import { logEvent } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

export async function GET() {
  const sb = createAdminClient()
  const { data, error } = await sb.from("dashboard_widgets").select("*").order("sort_order")
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const kind = String(body.kind || "entities")
    const sb = createAdminClient()

    const { data: existing, error: existingError } = await sb
      .from("dashboard_widgets")
      .select("id")
      .eq("kind", kind)
      .limit(1)
    if (existingError) throw new Error(existingError.message)
    if (existing?.length) {
      return NextResponse.json({ error: "widget kind already exists" }, { status: 409 })
    }

    const { data: rows } = await sb
      .from("dashboard_widgets")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
    const nextOrder =
      body.sort_order != null
        ? Number(body.sort_order)
        : Number(rows?.[0]?.sort_order ?? -1) + 1

    const { data, error } = await sb
      .from("dashboard_widgets")
      .insert({
        kind,
        title: body.title || "",
        config: body.config || {},
        sort_order: nextOrder,
      })
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    await logEvent({ kind: "dashboard.add", title: "Виджет добавлен", detail: data.kind })
    return NextResponse.json({ item: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const id = String(body.id || "")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    const patch: Record<string, unknown> = {}
    if (body.title != null) patch.title = String(body.title)
    if (body.kind != null) patch.kind = String(body.kind)
    if (body.config != null) patch.config = body.config
    if (body.sort_order != null) patch.sort_order = Number(body.sort_order)
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
    const { data, error } = await sb.from("dashboard_widgets").update(patch).eq("id", id).select("*").single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ item: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    const sb = createAdminClient()
    const { error } = await sb.from("dashboard_widgets").delete().eq("id", id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
