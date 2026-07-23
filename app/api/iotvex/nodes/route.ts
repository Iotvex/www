import { NextResponse } from "next/server"
import {
  decodeAgentNodes,
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

/** All online nodes decoded by HELLO kind (lights + opaque weather, etc.). */
export async function GET() {
  try {
    const opaque = await fetchOpaqueNodes()
    const nodes = decodeAgentNodes(opaque)
    return NextResponse.json({ nodes })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json(
      { error: err.message || String(e) },
      { status: err.status || 502 },
    )
  }
}
