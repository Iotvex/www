import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || "").trim()
    const password = String(body.password || "")
    if (!email || !password) {
      return NextResponse.json({ error: "Введите адрес электронной почты и пароль" }, { status: 400 })
    }

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "http://127.0.0.1:54321"
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!anon) {
      return NextResponse.json({ error: "Auth is not configured" }, { status: 500 })
    }

    const proto = request.headers.get("x-forwarded-proto")
    const secure =
      proto === "https" || new URL(request.url).protocol === "https:"

    const response = NextResponse.json({ ok: true })

    const supabase = createServerClient(supabaseUrl, anon, {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get("cookie") || ""
          return cookieHeader
            .split(";")
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) => {
              const i = c.indexOf("=")
              return {
                name: i === -1 ? c : c.slice(0, i),
                value: i === -1 ? "" : c.slice(i + 1),
              }
            })
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              path: options?.path ?? "/",
              sameSite: (options?.sameSite as "lax" | "strict" | "none") ?? "lax",
              secure: secure || Boolean(options?.secure),
            })
          })
        },
      },
    })

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    const out = NextResponse.json(
      { ok: true, user: { id: data.user!.id, email: data.user!.email } },
      { status: 200 },
    )
    response.cookies.getAll().forEach((c) => {
      out.cookies.set(c)
    })
    return out
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
