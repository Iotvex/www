import { NextResponse } from "next/server"
import {
  decodeAgentNodes,
  pickLightNodeView,
  type AgentOpaqueNode,
} from "@/shared/lib/iotvex-proto"

export const dynamic = "force-dynamic"

const AGENT = process.env.IOTVEX_AGENT_URL || "http://127.0.0.1:7421"

async function fetchOpaqueNodes(): Promise<AgentOpaqueNode[]> {
  const listRes = await fetch(`${AGENT}/nodes`, { cache: "no-store" })
  if (!listRes.ok) {
    const text = await listRes.text().catch(() => "")
    throw Object.assign(new Error(text || `agent ${listRes.status}`), {
      status: listRes.status,
    })
  }
  const body = (await listRes.json()) as { nodes?: AgentOpaqueNode[] }
  return body.nodes || []
}

/**
 * Multi-node inventory from agent `/nodes`.
 * Also returns `node` = primary light (compat for older clients / strip UI).
 */
export async function GET() {
  try {
    const opaque = await fetchOpaqueNodes()
    if (!opaque.length) {
      return NextResponse.json({ error: "no nodes online" }, { status: 503 })
    }
    const nodes = decodeAgentNodes(opaque)
    const node = pickLightNodeView(nodes) ?? nodes[0] ?? null
    return NextResponse.json({ nodes, node })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json(
      { error: err.message || String(e) },
      { status: err.status || 502 },
    )
  }
}
