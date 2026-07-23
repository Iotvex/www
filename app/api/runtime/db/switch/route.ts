import { NextResponse } from "next/server"
import { normalizeDbMode } from "@/shared/config/runtime"
import {
  getRuntimeConfig,
  publicRuntimeView,
} from "@/shared/config/runtime.server"
import { switchDatabase } from "@/shared/lib/home/db-switch"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = await switchDatabase({
      mode: normalizeDbMode(String(body.mode || "")),
      url: body.url != null ? String(body.url) : undefined,
      anonKey: body.anonKey != null ? String(body.anonKey) : undefined,
      serviceRoleKey:
        body.serviceRoleKey != null ? String(body.serviceRoleKey) : undefined,
      merge: body.merge !== false,
    })
    const runtime = getRuntimeConfig()
    const res = NextResponse.json({
      ...result,
      runtime: publicRuntimeView(runtime),
    })
    // Edge middleware reads these after hot DB switch (no container restart).
    const cookieOpts = {
      path: "/",
      sameSite: "lax" as const,
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
    }
    // Browser URL for local is same-origin proxy; middleware must hit upstream.
    const mwUrl =
      runtime.dbMode === "local"
        ? runtime.supabaseUrl
        : runtime.supabaseBrowserUrl.startsWith("http")
          ? runtime.supabaseBrowserUrl
          : runtime.supabaseUrl
    res.cookies.set("iotvex-sb-url", mwUrl, cookieOpts)
    res.cookies.set("iotvex-sb-anon", runtime.supabaseAnonKey || "", cookieOpts)
    res.cookies.set("iotvex-db-mode", runtime.dbMode, cookieOpts)
    return res
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 })
  }
}
