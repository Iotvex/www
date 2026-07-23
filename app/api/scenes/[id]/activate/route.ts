
import { NextResponse } from "next/server"
import { getScene } from "@/shared/lib/home/catalog"
import { runHomeAction } from "@/shared/lib/home/actions"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    const scene = await getScene(id)
    const results = []
    for (const [entityId, desired] of Object.entries(scene.entities || {})) {
      const d = (desired || {}) as Record<string, unknown>
      results.push(
        await runHomeAction({
          action: d.state === "off" ? "light.turn_off" : "light.turn_on",
          target: { entity_id: entityId },
          data: d,
        }),
      )
    }
    return NextResponse.json({ ok: true, id, results, source: "supabase" })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
