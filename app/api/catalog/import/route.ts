import { NextResponse } from "next/server"
import { createAdminClient } from "@/shared/lib/supabase/admin"
import { logEvent } from "@/shared/lib/home/events"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sb = createAdminClient()
    let imported = 0

    for (const row of body.areas || []) {
      const { error } = await sb.from("areas").upsert(row)
      if (error) throw new Error(`areas: ${error.message}`)
      imported++
    }
    for (const row of body.devices || []) {
      const { error } = await sb.from("devices").upsert(row)
      if (error) throw new Error(`devices: ${error.message}`)
      imported++
    }
    for (const row of body.entities || []) {
      const { error } = await sb.from("entities").upsert(row)
      if (error) throw new Error(`entities: ${error.message}`)
      imported++
    }
    for (const row of body.automations || []) {
      const { error } = await sb.from("automations").upsert(row)
      if (error) throw new Error(`automations: ${error.message}`)
      imported++
    }
    for (const row of body.scripts || []) {
      const { error } = await sb.from("scripts").upsert(row)
      if (error) throw new Error(`scripts: ${error.message}`)
      imported++
    }
    for (const row of body.scenes || []) {
      const { error } = await sb.from("scenes").upsert(row)
      if (error) throw new Error(`scenes: ${error.message}`)
      imported++
    }
    for (const row of body.widgets || []) {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = row
      const { error } = await sb.from("dashboard_widgets").upsert(row.id ? row : rest)
      if (error) throw new Error(`widgets: ${error.message}`)
      imported++
    }
    for (const row of body.modules || []) {
      const { error } = await sb.from("modules").upsert(row)
      if (error) throw new Error(`modules: ${error.message}`)
      imported++
    }

    await logEvent({
      kind: "catalog.import",
      title: "Импорт каталога",
      detail: `${imported} записей`,
    })
    return NextResponse.json({ ok: true, imported })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
