import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { runtimePaths, getRuntimeConfig, publicRuntimeView } from "@/shared/config/runtime.server"
import { fullMatrix } from "@/shared/config/matrix"

export const dynamic = "force-dynamic"

function statePath() {
  return path.join(runtimePaths().dir, "publish-state.json")
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), "utf8"))
  } catch {
    return { tunnels: {}, errors: [], desired: {} }
  }
}

/**
 * Publish manager runs on the HOME HOST (systemd), not inside the www container.
 * API only reads state / queues reconcile via config/publish-request (shared volume).
 */
export async function GET() {
  const runtime = getRuntimeConfig()
  return NextResponse.json({
    ok: true,
    matrix: fullMatrix(),
    bridge: runtime.bridge,
    cell: runtime.matrix,
    state: readState(),
    runtime: publicRuntimeView(runtime),
    note: "Tunnels are reconciled on the home host by iotvex-publish.timer",
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || "reconcile")
    const dir = runtimePaths().dir
    fs.mkdirSync(dir, { recursive: true })

    if (action === "stop-all") {
      fs.writeFileSync(
        path.join(dir, "publish-request"),
        JSON.stringify({ action: "stop-all", at: new Date().toISOString() }) + "\n",
      )
    } else if (action === "status") {
      return NextResponse.json({ ok: true, state: readState(), runtime: publicRuntimeView(getRuntimeConfig()) })
    } else {
      fs.writeFileSync(
        path.join(dir, "publish-request"),
        JSON.stringify({ action: "reconcile", at: new Date().toISOString() }) + "\n",
      )
    }

    return NextResponse.json({
      ok: true,
      queued: action,
      state: readState(),
      runtime: publicRuntimeView(getRuntimeConfig()),
      note: "Queued for host iotvex-publish.service (path trigger or next timer tick)",
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 })
  }
}
