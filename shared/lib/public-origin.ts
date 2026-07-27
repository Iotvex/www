import { effectiveBridge, loadRuntimeFile } from "@/shared/config/runtime.server"

function isUnusableHost(host: string): boolean {
  const name = host.split(":")[0]?.toLowerCase() || ""
  return (
    !name ||
    name === "0.0.0.0" ||
    name === "::" ||
    name === "[::]" ||
    name === "localhost" ||
    name === "127.0.0.1" ||
    name === "::1"
  )
}

/**
 * Public HTTPS/HTTP origin for this request.
 * Next.js standalone with HOSTNAME=0.0.0.0 makes request.url unusable
 * (e.g. https://0.0.0.0:3000/...), so prefer Host / X-Forwarded-* and
 * fall back to the published smart-home tunnel URL from runtime.json.
 */
export function publicRequestOrigin(request: Request): string {
  const hostHeader = request.headers.get("host")?.trim()
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const host =
    (hostHeader && !isUnusableHost(hostHeader) ? hostHeader : null) ||
    (forwardedHost && !isUnusableHost(forwardedHost) ? forwardedHost : null)

  if (host) {
    const forwardedProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      ?.toLowerCase()
    let proto = forwardedProto
    if (!proto) {
      if (host.includes("trycloudflare.com") || host.endsWith(":443")) proto = "https"
      else if (host.endsWith(":80") || host.endsWith(":3100")) proto = "http"
      else proto = "https"
    }
    return `${proto}://${host}`
  }

  const bridge = effectiveBridge(loadRuntimeFile())
  const configured = (bridge.smartHomePublicUrl || bridge.wwwPublicUrl || "").replace(/\/$/, "")
  if (configured) return configured

  // Last resort: keep query building working even if origin is wrong.
  try {
    return new URL(request.url).origin
  } catch {
    return "http://127.0.0.1"
  }
}
