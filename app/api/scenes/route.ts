
import { NextResponse } from "next/server"
import { createAdminClient } from "@/shared/lib/supabase/admin"
import { upsertScene } from "@/shared/lib/home/catalog"
import { logEvent } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

export async function GET() {
  const sb = createAdminClient()
  const { data, error } = await sb.from("scenes").select("*").order("name")
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const id = String(body.id || `scene_${Date.now()}`)
    const name = String(body.name || "").trim()
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })
    const row = await upsertScene({
      id,
      name,
      description: body.description || "",
      entities: body.entities || {},
      area_id: body.area_id || null,
    })
    await logEvent({ kind: "scene.save", title: `Сцена «${name}»`, detail: id })
    return NextResponse.json({ item: row })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
