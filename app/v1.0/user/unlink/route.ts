import { authorizeYandex, extractAccessToken, yandexJson } from "@/shared/lib/yandex-smart-home/auth"
import { loadYandexStore, saveYandexStore } from "@/shared/lib/yandex-smart-home/config"
import { requestIdOf } from "@/shared/lib/yandex-smart-home/devices"

export const dynamic = "force-dynamic"

/** POST /v1.0/user/unlink — account unlinked in Yandex */
export async function POST(request: Request) {
  const auth = authorizeYandex(request)
  if (!auth.ok) return yandexJson({ error: "unauthorized" }, auth.status)

  const store = loadYandexStore()
  const bearer = extractAccessToken(request)
  if (bearer && store.tokens[bearer]) {
    const refresh = store.tokens[bearer].refreshToken
    delete store.tokens[bearer]
    if (refresh) delete store.refresh[refresh]
    saveYandexStore(store)
  }

  return yandexJson({ request_id: requestIdOf(request) })
}
