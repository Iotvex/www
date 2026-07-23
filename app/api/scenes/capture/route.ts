import { NextResponse } from "next/server"
import { createAdminClient } from "@/shared/lib/supabase/admin"
import { upsertScene } from "@/shared/lib/home/catalog"
import { logEvent } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = String(body.name || "").trim()
    const entityIds: string[] = Array.isArray(body.entity_ids) ? body.entity_ids.map(String) : []
    if (!name || !entityIds.length) {
      return NextResponse.json({ error: "name and entity_ids required" }, { status: 400 })
    }
    const sb = createAdminClient()
    const { data: states, error } = await sb
      .from("entity_states")
      .select("*")
      .in("entity_id", entityIds)
    if (error) throw new Error(error.message)

    const entities: Record<string, Record<string, unknown>> = {}
    for (const st of states || []) {
      const attrs = (st.attributes || {}) as Record<string, unknown>
      const snap: Record<string, unknown> = { state: st.state }
      if (typeof attrs.brightness === "number") {
        snap.brightness = attrs.brightness
        snap.brightness_pct = Math.round((Number(attrs.brightness) / 255) * 100)
      }
      if (Array.isArray(attrs.rgb_color)) snap.rgb_color = attrs.rgb_color
      entities[st.entity_id] = snap
    }

    const id = String(body.id || `scene_${Date.now()}`)
    const row = await upsertScene({
      id,
      name,
      description: body.description || "Снимок текущего состояния",
      entities,
      area_id: body.area_id || null,
    })
    await logEvent({ kind: "scene.capture", title: `Сцена «${name}»`, detail: id, meta: { count: Object.keys(entities).length } })
    return NextResponse.json({ item: row })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
