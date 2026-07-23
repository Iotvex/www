import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/** Public origin of this request (works for any LAN/WAN IP:port). */
export function requestOrigin(request: Request): string | null {
  // Prefer Host (includes non-default port). X-Forwarded-Host is fallback.
  const hostHeader = request.headers.get("host")?.trim()
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const host = hostHeader || forwardedHost
  if (!host) return null

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    ?.toLowerCase()

  let proto = forwardedProto
  if (!proto) {
    if (host.endsWith(":8443") || host.endsWith(":443")) proto = "https"
    else if (host.endsWith(":3100") || host.endsWith(":80")) proto = "http"
    else proto = new URL(request.url).protocol.replace(":", "") || "https"
  }

  return `${proto}://${host}`
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
