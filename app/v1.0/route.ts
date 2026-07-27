import { loadYandexCatalog } from "@/shared/lib/home/catalog"
import { authorizeYandex, logYandexAccess, yandexJson } from "@/shared/lib/yandex-smart-home/auth"
import { discoveryPayload, requestIdOf } from "@/shared/lib/yandex-smart-home/devices"

export const dynamic = "force-dynamic"

/** Provider availability probe (Yandex HEAD /v1.0/). */
export async function HEAD() {
  logYandexAccess("HEAD /v1.0 200")
  return new Response(null, { status: 200 })
}

export async function GET(request: Request) {
  // Some probes use GET
  if (new URL(request.url).pathname.replace(/\/$/, "") === "/v1.0") {
    logYandexAccess("GET /v1.0 200")
    return new Response(null, { status: 200 })
  }
  return yandexJson({ error: "not found" }, 404)
}

/** Convenience: same discovery under POST when used incorrectly — prefer /user/devices. */
export async function POST(request: Request) {
  const auth = authorizeYandex(request)
  if (!auth.ok) return yandexJson({ error: "unauthorized" }, auth.status)
  const catalog = await loadYandexCatalog()
  return yandexJson({
    request_id: requestIdOf(request),
    payload: discoveryPayload(catalog),
  })
}
