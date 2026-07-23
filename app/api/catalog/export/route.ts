import { NextResponse } from "next/server"
import { loadHomeCatalog } from "@/shared/lib/home/catalog"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const catalog = await loadHomeCatalog()
    return NextResponse.json({
      version: 1,
      exported_at: new Date().toISOString(),
      areas: catalog.areas,
      devices: catalog.devices,
      entities: catalog.entities,
      automations: catalog.automations,
      scripts: catalog.scripts,
      scenes: catalog.scenes,
      widgets: catalog.widgets,
      modules: catalog.modules,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
