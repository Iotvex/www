import { NextResponse } from "next/server"
import { createClient } from "@/shared/lib/supabase/server"
import { hasValidServiceToken } from "@/shared/lib/api-auth"

export {
  serviceTokens,
  extractServiceToken,
  hasValidServiceToken,
  isPublicApiPath,
  authorizeApiRequest,
} from "@/shared/lib/api-auth"

/** Route-handler helper (Node runtime only — do not import from middleware). */
export async function requireApiAuth(request?: Request): Promise<{
  ok: true
  mode: "session" | "service"
  userId?: string
} | {
  ok: false
  response: NextResponse
}> {
  if (request && hasValidServiceToken(request)) {
    return { ok: true, mode: "service" }
  }
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.id) return { ok: true, mode: "session", userId: user.id }
  } catch {
    /* fall through */
  }
  return {
    ok: false,
    response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
  }
}
