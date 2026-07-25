import { NextResponse } from "next/server"
import { getAutomation, markAutomationTriggered } from "@/shared/lib/home/catalog"
import { runHomeActions } from "@/shared/lib/home/actions"
import { logEvent } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

/** Manual run — used by assistant voice and UI. */
export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params
    const auto = await getAutomation(id)
    if (!auto) {
      return NextResponse.json({ error: "not found" }, { status: 404 })
    }
    const results = await runHomeActions(auto.actions || [])
    await markAutomationTriggered(auto.id)
    await logEvent({
      kind: "automation.run",
      title: `Автоматизация «${auto.name}»`,
      detail: id,
    })
    return NextResponse.json({
      ok: true,
      id,
      name: auto.name,
      results,
      source: "manual",
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
