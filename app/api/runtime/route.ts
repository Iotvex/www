import { NextResponse } from "next/server"
import { getRuntimeConfig, publicRuntimeView } from "@/shared/config/runtime.server"

export const dynamic = "force-dynamic"

/** Local-only runtime status (read-only). */
export async function GET() {
  try {
    const runtime = getRuntimeConfig()
    return NextResponse.json({ ok: true, runtime: publicRuntimeView(runtime) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
