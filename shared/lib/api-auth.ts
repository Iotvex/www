import { createServerClient } from "@supabase/ssr"
import { type NextRequest } from "next/server"

/**
 * Edge-safe API auth helpers for middleware.
 * Keep Node-only helpers (cookies()/createClient) out of this module.
 */

export function serviceTokens(): string[] {
  return [process.env.IOTVEX_SERVICE_TOKEN, process.env.CRON_SECRET]
    .map((t) => (t || "").trim())
    .filter(Boolean)
}

export function extractServiceToken(request: Request | NextRequest): string {
  const auth = request.headers.get("authorization") || ""
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (m?.[1]) return m[1].trim()
  return (
    request.headers.get("x-iotvex-token") ||
    request.headers.get("x-cron-secret") ||
    ""
  ).trim()
}

export function hasValidServiceToken(request: Request | NextRequest): boolean {
  const token = extractServiceToken(request)
  if (!token) return false
  return serviceTokens().includes(token)
}

/** Paths that stay public (login flow + cron which has its own secret). */
export function isPublicApiPath(pathname: string): boolean {
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") return true
  if (pathname.startsWith("/api/cron/")) return true
  return false
}

function supabaseEdgeCreds(_request: NextRequest) {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "http://127.0.0.1:54321"
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  return { url, key }
}

/**
 * Edge-safe API gate for middleware. Mutates nothing; caller still runs updateSession.
 */
export async function authorizeApiRequest(request: NextRequest): Promise<boolean> {
  if (hasValidServiceToken(request)) return true

  const { url, key } = supabaseEdgeCreds(request)
  if (!key) return false

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll() {
        /* middleware refresh happens in updateSession */
      },
    },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return Boolean(user?.id)
}
