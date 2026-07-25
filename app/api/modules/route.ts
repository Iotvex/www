import { NextResponse } from "next/server"
import { createAdminClient } from "@/shared/lib/supabase/admin"
import { logEvent } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

/** Block SSRF via source_url — only https public hosts, no private/link-local. */
function assertSafeModuleUrl(raw: string): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new Error("invalid source_url")
  }
  if (u.protocol !== "https:") {
    throw new Error("source_url must be https")
  }
  const host = u.hostname.toLowerCase()
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^169\.254\.\d+\.\d+$/.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+$/.test(host)
  ) {
    throw new Error("source_url host not allowed")
  }
  const m = host.match(/^172\.(\d+)\./)
  if (m) {
    const n = Number(m[1])
    if (n >= 16 && n <= 31) throw new Error("source_url host not allowed")
  }
  return u
}

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
      const safe = assertSafeModuleUrl(source_url)
      const res = await fetch(safe.toString(), {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      })
      if (!res.ok) throw new Error(`module fetch ${res.status}`)
      const ct = (res.headers.get("content-type") || "").toLowerCase()
      if (!ct.includes("json")) throw new Error("source_url must return JSON")
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
