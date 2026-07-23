import { NextResponse } from "next/server"
import { createAdminClient } from "@/shared/lib/supabase/admin"
import { deleteArea, upsertArea } from "@/shared/lib/home/catalog"
import { logEvent } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

function slugify(input: string) {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  }
  const base = input
    .trim()
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
  return base || `area_${Date.now().toString(36)}`
}

export async function GET() {
  const sb = createAdminClient()
  const { data, error } = await sb.from("areas").select("*").order("sort_order")
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = String(body.name || "").trim()
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })
    const id = String(body.id || slugify(name))
    const row = await upsertArea({
      id,
      name,
      icon: body.icon || null,
      sort_order: Number(body.sort_order) || 0,
    })
    await logEvent({ kind: "area.create", title: `Зона «${name}»`, detail: id })
    return NextResponse.json({ item: row })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const id = String(body.id || "").trim()
    const name = String(body.name || "").trim()
    if (!id || !name) return NextResponse.json({ error: "id/name required" }, { status: 400 })
    const sb = createAdminClient()
    const { data: existing, error: readErr } = await sb.from("areas").select("*").eq("id", id).single()
    if (readErr) throw new Error(readErr.message)
    const row = await upsertArea({
      id,
      name,
      icon: body.icon ?? existing.icon,
      sort_order: Number(body.sort_order ?? existing.sort_order) || 0,
    })
    await logEvent({ kind: "area.update", title: `Зона «${name}»`, detail: id })
    return NextResponse.json({ item: row })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    await deleteArea(id)
    await logEvent({ kind: "area.delete", title: "Зона удалена", detail: id })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
