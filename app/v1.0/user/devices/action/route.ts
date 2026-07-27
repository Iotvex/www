import { handleActions } from "@/shared/lib/yandex-smart-home/actions"
import { authorizeYandex, logYandexAccess, yandexJson } from "@/shared/lib/yandex-smart-home/auth"
import { requestIdOf } from "@/shared/lib/yandex-smart-home/devices"

export const dynamic = "force-dynamic"

/** POST /v1.0/user/devices/action */
export async function POST(request: Request) {
  const t0 = Date.now()
  const auth = authorizeYandex(request)
  const rid = requestIdOf(request)
  if (!auth.ok) {
    logYandexAccess(`ACTION 401 rid=${rid}`)
    return yandexJson({ request_id: rid, error: "unauthorized" }, auth.status)
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      payload?: {
        devices?: Array<{
          id: string
          custom_data?: Record<string, unknown>
          capabilities?: Array<{
            type: string
            state?: { instance?: string; value?: unknown; relative?: boolean }
          }>
        }>
      }
    }
    const devices = body.payload?.devices || []
    const results = await handleActions(devices)
    logYandexAccess(`ACTION 200 rid=${rid} n=${devices.length} ms=${Date.now() - t0}`)
    return yandexJson({
      request_id: rid,
      payload: { devices: results },
    })
  } catch (e) {
    logYandexAccess(`ACTION 500 rid=${rid} err=${String(e)} ms=${Date.now() - t0}`)
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
