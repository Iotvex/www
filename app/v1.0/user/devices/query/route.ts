import { loadYandexCatalog } from "@/shared/lib/home/catalog"
import { authorizeYandex, logYandexAccess, yandexJson } from "@/shared/lib/yandex-smart-home/auth"
import { buildQueryStates, requestIdOf } from "@/shared/lib/yandex-smart-home/devices"

export const dynamic = "force-dynamic"

/** POST /v1.0/user/devices/query */
export async function POST(request: Request) {
  const t0 = Date.now()
  const auth = authorizeYandex(request)
  const rid = requestIdOf(request)
  if (!auth.ok) {
    logYandexAccess(`QUERY 401 rid=${rid}`)
    return yandexJson({ request_id: rid, error: "unauthorized" }, auth.status)
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      devices?: Array<{ id: string }>
    }
    const ids = (body.devices || []).map((d) => d.id).filter(Boolean)
    const catalog = await loadYandexCatalog()
    const devices = buildQueryStates(catalog, ids)
    logYandexAccess(`QUERY 200 rid=${rid} n=${devices.length} ms=${Date.now() - t0}`)
    return yandexJson({
      request_id: rid,
      payload: { devices },
    })
  } catch (e) {
    logYandexAccess(`QUERY 500 rid=${rid} err=${String(e)} ms=${Date.now() - t0}`)
    return yandexJson(
      {
        request_id: rid,
        payload: { devices: [] },
        error_message: String(e),
      },
      500,
    )
  }
}
