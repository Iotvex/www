import { NextResponse } from "next/server"
import {
  MSG,
  decodeAgentNode,
  packSetStripPayload,
  pickLightOpaqueNode,
  type AgentOpaqueNode,
  type ProtoStrip,
} from "@/shared/lib/iotvex-proto"

export const dynamic = "force-dynamic"
const AGENT = process.env.IOTVEX_AGENT_URL || "http://127.0.0.1:7421"

/**
 * Build a full SET_STRIP frame payload and forward via the agent pipe.
 * Strip merge / field defaults belong here (or the client) — not the agent.
 * Targets the light node explicitly when weather + light are both online.
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

  try {
    const listRes = await fetch(`${AGENT}/nodes`, { cache: "no-store" })
    if (!listRes.ok) {
      const text = await listRes.text().catch(() => "")
      return NextResponse.json(
        { error: text || `agent ${listRes.status}` },
        { status: listRes.status },
      )
    }
    const listBody = (await listRes.json()) as { nodes?: AgentOpaqueNode[] }
    const light = pickLightOpaqueNode(listBody.nodes || [])
    if (!light) {
      return NextResponse.json({ error: "no light node online" }, { status: 503 })
    }

    const res = await fetch(`${AGENT}/node/${light.node_id}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: MSG.SET_STRIP,
        payload_b64: packSetStripPayload(strip),
        need_ack: true,
      }),
    })
    const text = await res.text()
    if (!res.ok) {
      return new NextResponse(text, {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      })
    }
    const opaque = JSON.parse(text) as AgentOpaqueNode
    const node = decodeAgentNode(opaque)
    return NextResponse.json(node)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
