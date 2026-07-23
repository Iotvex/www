import { NextResponse } from "next/server"
import { createAdminClient } from "@/shared/lib/supabase/admin"
import { logEvent } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

export async function GET() {
  const sb = createAdminClient()
  const { data, error } = await sb.from("modules").select("*").order("name")
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sb = createAdminClient()
    let manifest = body.manifest || {}
    const source_url = body.source_url ? String(body.source_url) : null
    if (source_url && !body.manifest) {
      const res = await fetch(source_url, { cache: "no-store" })
      if (!res.ok) throw new Error(`module fetch ${res.status}`)
      manifest = await res.json()
    }
    const id = String(body.id || manifest.id || `mod_${Date.now()}`)
    const name = String(body.name || manifest.name || id)
    const { data, error } = await sb
      .from("modules")
      .upsert({
        id,
        name,
        description: body.description || manifest.description || "",
        source_url,
        enabled: body.enabled !== false,
        manifest,
      })
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    await logEvent({ kind: "module.install", title: `Модуль «${name}»`, detail: id })
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
    const sb = createAdminClient()
    const patch: Record<string, unknown> = {}
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled
    if (body.name) patch.name = String(body.name)
    if (body.description != null) patch.description = String(body.description)
    if (body.source_url != null) patch.source_url = String(body.source_url)
    if (body.manifest) patch.manifest = body.manifest
    const { data, error } = await sb.from("modules").update(patch).eq("id", id).select("*").single()
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
    const { error } = await sb.from("modules").delete().eq("id", id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
