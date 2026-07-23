import { NextResponse } from "next/server"
import { createAdminClient } from "@/shared/lib/supabase/admin"
import { logEvent } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

export async function GET() {
  const sb = createAdminClient()
  const { data, error } = await sb.from("devices").select("*").order("name")
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
    if (body.manufacturer != null) patch.manufacturer = String(body.manufacturer)
    if (body.model != null) patch.model = String(body.model)

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 })
    }

    const sb = createAdminClient()
    const { data, error } = await sb.from("devices").update(patch).eq("id", id).select("*").single()
    if (error) throw new Error(error.message)

    let cascaded = 0
    if (body.cascade_area && "area_id" in body) {
      const { data: ents, error: e2 } = await sb
        .from("entities")
        .update({ area_id: patch.area_id })
        .eq("device_id", id)
        .select("id")
      if (e2) throw new Error(e2.message)
      cascaded = ents?.length || 0
    }

    await logEvent({
      kind: "device.update",
      title: `Устройство «${data.name}»`,
      detail: id,
      meta: { ...patch, cascaded },
    })
    return NextResponse.json({ item: data, cascaded })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
