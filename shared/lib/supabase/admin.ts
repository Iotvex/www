import { createClient } from "@supabase/supabase-js"
import { getRuntimeConfig } from "@/shared/config/runtime.server"

/** Service-role client for server routes (bypasses RLS). Honors runtime DB switch. */
export function createAdminClient() {
  const runtime = getRuntimeConfig()
  const url = runtime.supabaseUrl
  const key = runtime.supabaseServiceRoleKey
  if (!key) throw new Error("Supabase service role key is not set for active DB mode")
  if (!url) throw new Error("Supabase URL is not set for active DB mode")
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
