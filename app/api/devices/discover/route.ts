import { NextResponse } from "next/server"
import { discoverFromAgent } from "@/shared/lib/home/catalog"
import { logEvent } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const agent = process.env.IOTVEX_AGENT_URL || "http://127.0.0.1:7421"
    const result = await discoverFromAgent(agent)
    await logEvent({
      kind: "device.discover",
      title: "Обнаружение устройств",
      detail: `Узлов: ${result.nodes.length}, сущностей: ${result.entities.length}`,
      meta: {
        node_ids: result.nodes.map((n) => n.node_id),
        kinds: result.nodes.map((n) => n.kind),
        entities: result.entities,
      },
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
