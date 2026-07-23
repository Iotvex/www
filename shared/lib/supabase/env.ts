/**
 * Browser + isomorphic fallbacks.
 * Server routes/middleware should prefer env.server.ts / runtime.server.ts.
 */

export type BrowserRuntimeInject = {
  supabaseBrowserUrl: string
  supabaseAnonKey: string
  dbMode: string
  wwwMode: string
  mdnsName: string
}

declare global {
  interface Window {
    __IOTVEX_RUNTIME__?: BrowserRuntimeInject
  }
}

export function getSupabaseBrowserUrl() {
  if (typeof window !== "undefined") {
    const inj = window.__IOTVEX_RUNTIME__
    if (inj?.supabaseBrowserUrl) {
      const b = inj.supabaseBrowserUrl
      return b.startsWith("/") ? `${window.location.origin}${b}` : b
    }
  }
  const pub = process.env.NEXT_PUBLIC_SUPABASE_BROWSER_URL || "/supabase"
  if (typeof window !== "undefined" && pub.startsWith("/")) {
    return `${window.location.origin}${pub}`
  }
  if (pub.startsWith("/")) return pub
  return pub || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
}

/** @deprecated for server — use getServerSupabaseUrl */
export function getSupabaseUrl() {
  if (typeof window !== "undefined") return getSupabaseBrowserUrl()
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "http://127.0.0.1:54321"
  )
}

export function getSupabaseAnonKey() {
  if (typeof window !== "undefined") {
    return (
      window.__IOTVEX_RUNTIME__?.supabaseAnonKey ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ""
    )
  }
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  )
}
