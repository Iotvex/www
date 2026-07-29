/**
 * Client-safe runtime helpers (local-only panel).
 */

export type DbMode = "local"
export type WwwMode = "local"

export function normalizeWwwMode(_raw?: string | null): WwwMode {
  return "local"
}

export function normalizeDbMode(_raw?: string | null): DbMode {
  return "local"
}

/** True for loopback / private LAN agent URLs (device plane stays home). */
export function isLocalOrPrivateUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true
    if (host === "host.docker.internal") return true
    if (host.endsWith(".local")) return true
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true
    return false
  } catch {
    return false
  }
}
