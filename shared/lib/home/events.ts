
import { createAdminClient } from "@/shared/lib/supabase/admin"

export async function logEvent(input: {
  kind: string
  title: string
  detail?: string
  entity_id?: string | null
  meta?: Record<string, unknown>
}) {
  const sb = createAdminClient()
  await sb.from("events").insert({
    kind: input.kind,
    title: input.title,
    detail: input.detail || "",
    entity_id: input.entity_id || null,
    meta: input.meta || {},
  })
}

export async function listEvents(limit = 100) {
  const sb = createAdminClient()
  const { data, error } = await sb
    .from("events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data || []
}
