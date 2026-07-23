import { NextResponse } from "next/server"
import { normalizeDbMode, normalizeWwwMode } from "@/shared/config/runtime"
import {
  getRuntimeConfig,
  loadRuntimeFile,
  publicRuntimeView,
  saveRuntimeFile,
  saveSecretsFile,
} from "@/shared/config/runtime.server"

export const dynamic = "force-dynamic"

async function probeAgent(agentUrl: string) {
  try {
    const res = await fetch(`${agentUrl.replace(/\/$/, "")}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return { ok: false as const, status: res.status }
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean }
    return { ok: Boolean(body.ok ?? true), status: res.status }
  } catch (e) {
    return { ok: false as const, error: String(e) }
  }
}

export async function GET() {
  const runtime = getRuntimeConfig()
  const agent = await probeAgent(runtime.agentUrl)
  const view = publicRuntimeView(runtime)
  return NextResponse.json({
    ok: true,
    runtime: {
      ...view,
      supabaseAnonKey: runtime.supabaseAnonKey,
    },
    agent,
    file: {
      wwwMode: loadRuntimeFile().wwwMode,
      dbMode: loadRuntimeFile().db.mode,
      mdnsName: loadRuntimeFile().mdnsName,
    },
    notes: {
      www: "local | local_published | cloud",
      db: "local | cloud_public | cloud_private",
      automations:
        "Config in DB; ticks via home systemd → http://127.0.0.1:3100/api/cron/automations → agent",
    },
  })
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = {}

    if (body.wwwMode != null) patch.wwwMode = normalizeWwwMode(String(body.wwwMode))
    if (body.mdnsName != null) {
      let name = String(body.mdnsName).trim()
      if (!name) name = "iotvex.local"
      if (!name.includes(".")) name = `${name}.local`
      patch.mdnsName = name
    }
    if (body.timezone != null) patch.timezone = String(body.timezone)
    if (body.publish != null && typeof body.publish === "object") {
      patch.publish = body.publish
    }
    if (body.cloudWww != null && typeof body.cloudWww === "object") {
      patch.cloudWww = body.cloudWww
    }
    if (body.bridge != null && typeof body.bridge === "object") {
      patch.bridge = body.bridge
    }
    if (body.db != null && typeof body.db === "object") {
      const db = body.db as Record<string, unknown>
      const cur = loadRuntimeFile().db
      patch.db = {
        ...cur,
        ...db,
        mode: db.mode != null ? normalizeDbMode(String(db.mode)) : cur.mode,
      }
    }

    const saved = saveRuntimeFile(patch)

    if (body.secrets?.publish && typeof body.secrets.publish === "object") {
      saveSecretsFile({ publish: body.secrets.publish })
    }
    if (body.secrets?.db && typeof body.secrets.db === "object") {
      saveSecretsFile({ db: body.secrets.db })
    }

    return NextResponse.json({
      ok: true,
      runtime: publicRuntimeView(getRuntimeConfig()),
      file: saved,
      reloadRequired: Boolean(body.reload),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
