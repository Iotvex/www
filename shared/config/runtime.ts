/**
 * Client-safe runtime types + mode normalizers.
 * File I/O and getRuntimeConfig live in runtime.server.ts (server-only).
 */

export type WwwMode = "local" | "local_published" | "cloud"
export type DbMode = "local" | "cloud_public" | "cloud_private"

export type PublishProviderId =
  | "caddy_local"
  | "pinggy"
  | "cloudflare_tunnel"
  | "ngrok"
  | "tailscale_funnel"

const WWW_MODES = ["local", "local_published", "cloud"] as const
const DB_MODES = ["local", "cloud_public", "cloud_private"] as const

export function normalizeWwwMode(raw?: string | null): WwwMode {
  const v = (raw || "").trim().toLowerCase().replace(/-/g, "_")
  if (v === "lan") return "local"
  if (v === "published") return "local_published"
  if ((WWW_MODES as readonly string[]).includes(v)) return v as WwwMode
  return "local"
}

export function normalizeDbMode(raw?: string | null): DbMode {
  const v = (raw || "").trim().toLowerCase().replace(/-/g, "_")
  if (v === "remote") return "cloud_private"
  if ((DB_MODES as readonly string[]).includes(v)) return v as DbMode
  return "local"
}

export function isLocalOrPrivateUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    if (host === "127.0.0.1" || host === "localhost" || host === "::1") return true
    if (host === "host.docker.internal") return true
    if (host.endsWith(".local")) return true
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true
    const m = host.match(/^172\.(\d+)\./)
    if (m) {
      const n = Number(m[1])
      if (n >= 16 && n <= 31) return true
    }
    return false
  } catch {
    return false
  }
}
