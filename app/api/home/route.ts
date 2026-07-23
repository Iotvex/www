
import { NextResponse } from "next/server"
import { loadHomeCatalog } from "@/shared/lib/home/catalog"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const catalog = await loadHomeCatalog()
    return NextResponse.json(catalog)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
