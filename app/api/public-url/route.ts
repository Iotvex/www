import { NextResponse } from "next/server"
import { publicRequestOrigin } from "@/shared/lib/public-origin"

export const dynamic = "force-dynamic"

/** Public origin of this request (works for any LAN/WAN IP:port). */
export function requestOrigin(request: Request): string | null {
  const origin = publicRequestOrigin(request)
  try {
    const host = new URL(origin).hostname
    if (host === "0.0.0.0" || host === "127.0.0.1" || host === "localhost") return null
  } catch {
    return null
  }
  return origin
}

export async function GET(request: Request) {
  const url = requestOrigin(request)
  return NextResponse.json({
    url,
    public_url: url,
    trusted_tls: false,
    note: "Derived from this request Host (no static URL binding)",
  })
}
