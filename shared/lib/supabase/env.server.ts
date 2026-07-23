import "server-only"
import { getRuntimeConfig } from "@/shared/config/runtime.server"

export function getServerSupabaseUrl() {
  return getRuntimeConfig().supabaseUrl
}

export function getServerSupabaseAnonKey() {
  const runtime = getRuntimeConfig()
  return (
    runtime.supabaseAnonKey ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  )
}
