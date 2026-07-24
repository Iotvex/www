import { NextResponse } from "next/server"
import {
  decodeAgentNodes,
  lightStripEntityId,
  type AgentOpaqueNode,
} from "@/shared/lib/iotvex-proto"
import { defaultStripName } from "@/shared/lib/home/action-options"

export const dynamic = "force-dynamic"

const AGENT = process.env.IOTVEX_AGENT_URL || "http://127.0.0.1:7421"

/**
 * Flat list of online light strips for voice assistant / external control.
 * Shape matches what assistant/app/home.py expects.
 */
export async function GET() {
  try {
    const listRes = await fetch(`${AGENT}/nodes`, { cache: "no-store" })
    if (!listRes.ok) {
      const text = await listRes.text().catch(() => "")
      return NextResponse.json(
        { error: text || `agent ${listRes.status}` },
        { status: listRes.status },
      )
    }
    const body = (await listRes.json()) as { nodes?: AgentOpaqueNode[] }
    const nodes = decodeAgentNodes(body.nodes || [])
    const strips: Array<{
      id: string
      name: string
      index: number
      node_id: number
      on: boolean
      brightness: number
      r: number
      g: number
      b: number
      effect: number
      speed: number
    }> = []

    for (const node of nodes) {
      if (!node.strips?.length) continue
      node.strips.forEach((s, idx) => {
        const index = Number.isFinite(s.index) ? Number(s.index) : idx
        strips.push({
          id: lightStripEntityId(node.node_id, index),
          name: defaultStripName(index),
          index,
          node_id: node.node_id,
          on: Boolean(s.on),
          brightness: Number(s.brightness ?? 255),
          r: Number(s.r ?? 255),
          g: Number(s.g ?? 255),
          b: Number(s.b ?? 255),
          effect: Number(s.effect ?? 0),
          speed: Number(s.speed ?? 128),
        })
      })
    }

    return NextResponse.json(strips)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
