import { NextResponse } from "next/server"
import { createAdminClient } from "@/shared/lib/supabase/admin"
import { logEvent } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

export async function GET() {
  const sb = createAdminClient()
  const { data, error } = await sb.from("entities").select("*").order("name")
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ items: data || [] })
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const id = String(body.id || "").trim()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const patch: Record<string, unknown> = {}
    if (body.name != null) patch.name = String(body.name).trim()
    if ("area_id" in body) patch.area_id = body.area_id ? String(body.area_id) : null
    if ("device_id" in body) patch.device_id = body.device_id ? String(body.device_id) : null
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled
    if (body.capabilities) patch.capabilities = body.capabilities
    if (body.attributes) patch.attributes = body.attributes

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 })
    }

    const sb = createAdminClient()
    const { data, error } = await sb.from("entities").update(patch).eq("id", id).select("*").single()
    if (error) throw new Error(error.message)
    await logEvent({
      kind: "entity.update",
      title: `Объект «${data.name}»`,
      detail: id,
      entity_id: id,
      meta: patch,
    })
    return NextResponse.json({ item: data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
