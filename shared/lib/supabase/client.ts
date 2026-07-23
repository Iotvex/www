import { createBrowserClient } from "@supabase/ssr"
import { getSupabaseAnonKey, getSupabaseBrowserUrl } from "./env"

export function createClient() {
  return createBrowserClient(getSupabaseBrowserUrl(), getSupabaseAnonKey())
}
