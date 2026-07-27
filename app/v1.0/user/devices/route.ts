import { loadYandexCatalog } from "@/shared/lib/home/catalog"
import { authorizeYandex, logYandexAccess, yandexJson } from "@/shared/lib/yandex-smart-home/auth"
import { discoveryPayload, requestIdOf } from "@/shared/lib/yandex-smart-home/devices"

export const dynamic = "force-dynamic"

/** GET /v1.0/user/devices — discovery */
export async function GET(request: Request) {
  const t0 = Date.now()
  const auth = authorizeYandex(request)
  const rid = requestIdOf(request)
  if (!auth.ok) {
    logYandexAccess(`DISCOVERY 401 rid=${rid} auth=${(request.headers.get("authorization") || "").slice(0, 24)}`)
    return yandexJson({ request_id: rid, error: "unauthorized" }, auth.status)
  }
  try {
    const catalog = await loadYandexCatalog()
    const payload = discoveryPayload(catalog)
    logYandexAccess(
      `DISCOVERY 200 rid=${rid} user=${auth.userId} devices=${payload.devices.length} ms=${Date.now() - t0}`,
    )
    return yandexJson({
      request_id: rid,
      payload,
    })
  } catch (e) {
    logYandexAccess(`DISCOVERY 500 rid=${rid} err=${String(e)} ms=${Date.now() - t0}`)
    return yandexJson(
      {
        request_id: rid,
        payload: { user_id: "iotvex-home", devices: [] },
        error_code: "INTERNAL_ERROR",
        error_message: String(e),
      },
      500,
    )
  }
}
