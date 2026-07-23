
import { NextResponse } from "next/server"
import { getScript, touchScript } from "@/shared/lib/home/catalog"
import { runHomeActions } from "@/shared/lib/home/actions"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    const script = await getScript(id)
    const results = await runHomeActions(script.sequence || [])
    await touchScript(id)
    return NextResponse.json({ ok: true, id, results, source: "supabase" })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
