import { NextResponse } from "next/server"
import {
  MSG,
  packSetStripPayload,
  pickLightOpaqueNode,
  type AgentOpaqueNode,
  type ProtoStrip,
} from "@/shared/lib/iotvex-proto"

export const dynamic = "force-dynamic"
const AGENT = process.env.IOTVEX_AGENT_URL || "http://127.0.0.1:7421"

async function resolveLightNodeId(preferred?: number): Promise<number | null> {
  if (preferred != null && Number.isFinite(preferred) && preferred > 0) {
    return preferred
  }
  const listRes = await fetch(`${AGENT}/nodes`, {
    cache: "no-store",
    signal: AbortSignal.timeout(1500),
  })
  if (!listRes.ok) return null
  const listBody = (await listRes.json()) as { nodes?: AgentOpaqueNode[] }
  const light = pickLightOpaqueNode(listBody.nodes || [])
  return light ? Number(light.node_id) : null
}

/**
 * Fire SET_STRIP via the agent pipe.
 * Prefer client-provided node_id to skip /nodes. need_ack=false so the UI stays snappy;
 * optimistic client state + live poll reconcile the strip.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ index: string }> },
) {
  const { index } = await ctx.params
  const body = await request.json()
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "json object required" }, { status: 400 })
  }

  const idx = Number(index)
  if (!Number.isFinite(idx) || idx < 0) {
    return NextResponse.json({ error: "bad strip index" }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const strip: ProtoStrip = {
    index: idx,
    on: Boolean(b.on ?? true),
    brightness: Number(b.brightness ?? 255),
    r: Number(b.r ?? 255),
    g: Number(b.g ?? 255),
    b: Number(b.b ?? 255),
    effect: Number(b.effect ?? 0),
    speed: Number(b.speed ?? 128),
  }

  const preferredNodeId = Number(b.node_id)
  try {
    const nodeId = await resolveLightNodeId(
      Number.isFinite(preferredNodeId) ? preferredNodeId : undefined,
    )
    if (nodeId == null) {
      return NextResponse.json({ error: "no light node online" }, { status: 503 })
    }

    const res = await fetch(`${AGENT}/node/${nodeId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(2500),
      body: JSON.stringify({
        msg_type: MSG.SET_STRIP,
        payload_b64: packSetStripPayload(strip),
        // Do not block the HTTP round-trip on Thread ACK — that was ~3–4s of lag.
        need_ack: false,
      }),
    })
    const text = await res.text()
    if (!res.ok) {
      return new NextResponse(text || `agent ${res.status}`, {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Return lightly so the client can keep optimistic state (no stale ACK merge).
    return NextResponse.json({ ok: true, node_id: nodeId, strip })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
