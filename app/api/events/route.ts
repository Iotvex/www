import { NextResponse } from "next/server"
import { createAdminClient } from "@/shared/lib/supabase/admin"
import { listEvents } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const kind = new URL(request.url).searchParams.get("kind")
    const limit = Number(new URL(request.url).searchParams.get("limit") || 150)
    if (kind) {
      const sb = createAdminClient()
      const { data, error } = await sb
        .from("events")
        .select("*")
        .eq("kind", kind)
        .order("created_at", { ascending: false })
        .limit(limit)
      if (error) throw new Error(error.message)
      return NextResponse.json({ items: data || [] })
    }
    const items = await listEvents(limit)
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: String(e), items: [] }, { status: 502 })
  }
}

export async function DELETE() {
  try {
    const sb = createAdminClient()
    const { error } = await sb.from("events").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
