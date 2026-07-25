import { NextResponse } from "next/server"
import {
  decodeAgentNodes,
  type AgentOpaqueNode,
} from "@/shared/lib/iotvex-proto"
import { agentFetch } from "@/shared/lib/agent-fetch"

export const dynamic = "force-dynamic"

type CacheEntry = { at: number; body: string; status: number }
let nodesCache: CacheEntry | null = null
const CACHE_MS = 1200

async function fetchOpaqueNodes(): Promise<AgentOpaqueNode[]> {
  const listRes = await agentFetch("/nodes", { signal: AbortSignal.timeout(4000) })
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
  const now = Date.now()
  if (nodesCache && now - nodesCache.at < CACHE_MS) {
    return new NextResponse(nodesCache.body, {
      status: nodesCache.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Iotvex-Nodes-Cache": "hit",
      },
    })
  }

  try {
    const opaque = await fetchOpaqueNodes()
    const nodes = decodeAgentNodes(opaque)
    const body = JSON.stringify({ nodes })
    nodesCache = { at: now, body, status: 200 }
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Iotvex-Nodes-Cache": "miss",
      },
    })
  } catch (e) {
    const err = e as Error & { status?: number }
    const status = err.status || 502
    // Serve brief stale success on transient agent blips (keeps UI from flapping).
    if (nodesCache && now - nodesCache.at < 8000 && status >= 500) {
      return new NextResponse(nodesCache.body, {
        status: nodesCache.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Iotvex-Nodes-Cache": "stale",
        },
      })
    }
    return NextResponse.json(
      { error: err.message || String(e) },
      { status },
    )
  }
}
