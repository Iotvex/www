import { NextResponse } from "next/server"
import { createAdminClient } from "@/shared/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const sb = createAdminClient()
    const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 100 })
    if (error) throw new Error(error.message)
    const items = (data.users || []).map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }))
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: String(e), items: [] }, { status: 502 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || "").trim()
    const password = String(body.password || "")
    if (!email || password.length < 6) {
      return NextResponse.json({ error: "email and password (6+) required" }, { status: 400 })
    }
    const sb = createAdminClient()
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) throw new Error(error.message)
    return NextResponse.json({
      item: { id: data.user?.id, email: data.user?.email },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
