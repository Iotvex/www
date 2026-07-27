import { NextResponse } from "next/server"
import { logYandexAccess } from "@/shared/lib/yandex-smart-home/auth"
import {
  YANDEX_USER_ID,
  loadYandexStore,
  newToken,
  saveYandexStore,
} from "@/shared/lib/yandex-smart-home/config"

export const dynamic = "force-dynamic"

async function readBody(request: Request): Promise<URLSearchParams> {
  const ctype = request.headers.get("content-type") || ""
  if (ctype.includes("application/json")) {
    const j = (await request.json().catch(() => ({}))) as Record<string, string>
    return new URLSearchParams(Object.entries(j).map(([k, v]) => [k, String(v ?? "")]))
  }
  const text = await request.text()
  return new URLSearchParams(text)
}

/** RFC 6749 §2.3.1 — Yandex Dialogs sends client_id:client_secret via Basic. */
function credentialsFromBasic(request: Request): { clientId: string; clientSecret: string } | null {
  const auth = request.headers.get("authorization") || ""
  const m = auth.match(/^Basic\s+(.+)$/i)
  if (!m?.[1]) return null
  try {
    const decoded = Buffer.from(m[1].trim(), "base64").toString("utf8")
    const idx = decoded.indexOf(":")
    if (idx < 0) return null
    return {
      clientId: decoded.slice(0, idx),
      clientSecret: decoded.slice(idx + 1),
    }
  } catch {
    return null
  }
}

/**
 * POST /oauth/token — authorization_code or refresh_token.
 * Also accepts client_credentials for local testing with service secret.
 */
export async function POST(request: Request) {
  const params = await readBody(request)
  const url = new URL(request.url)
  // Also accept query params (some clients)
  for (const [k, v] of url.searchParams) {
    if (!params.has(k)) params.set(k, v)
  }

  const grant = params.get("grant_type") || ""
  const basic = credentialsFromBasic(request)
  // Basic wins when present (Yandex ignores body credentials if Authorization is set).
  const clientId = (basic?.clientId || params.get("client_id") || "").trim()
  const clientSecret = (basic?.clientSecret || params.get("client_secret") || "").trim()
  const store = loadYandexStore()

  if (clientId !== store.clientId || clientSecret !== store.clientSecret) {
    logYandexAccess(
      `OAUTH token 401 invalid_client grant=${grant} via=${basic ? "basic" : "body"} id=${clientId || "-"}`,
    )
    return NextResponse.json({ error: "invalid_client" }, { status: 401 })
  }

  const now = Date.now()
  const accessTtlMs = 90 * 24 * 3600 * 1000 // 90 days — private skill

  if (grant === "authorization_code") {
    const code = params.get("code") || ""
    const redirectUri = (params.get("redirect_uri") || "").trim()
    const row = store.codes[code]
    if (!row || row.expiresAt < now) {
      logYandexAccess(`OAUTH token 400 invalid_grant code grant=${grant}`)
      return NextResponse.json({ error: "invalid_grant" }, { status: 400 })
    }
    if (redirectUri && row.redirectUri && redirectUri !== row.redirectUri) {
      logYandexAccess(`OAUTH token 400 invalid_grant redirect_uri mismatch`)
      return NextResponse.json({ error: "invalid_grant" }, { status: 400 })
    }
    delete store.codes[code]
    const access = newToken()
    const refresh = newToken()
    store.tokens[access] = {
      userId: row.userId,
      refreshToken: refresh,
      createdAt: now,
      expiresAt: now + accessTtlMs,
    }
    store.refresh[refresh] = { accessToken: access, userId: row.userId }
    saveYandexStore(store)
    logYandexAccess(`OAUTH token 200 grant=authorization_code user=${row.userId} via=${basic ? "basic" : "body"}`)
    return NextResponse.json({
      access_token: access,
      refresh_token: refresh,
      token_type: "bearer",
      expires_in: Math.floor(accessTtlMs / 1000),
    })
  }

  if (grant === "refresh_token") {
    const refresh = params.get("refresh_token") || ""
    const ref = store.refresh[refresh]
    if (!ref) {
      logYandexAccess(`OAUTH token 400 invalid_grant refresh`)
      return NextResponse.json({ error: "invalid_grant" }, { status: 400 })
    }
    // rotate
    delete store.tokens[ref.accessToken]
    const access = newToken()
    const newRefresh = newToken()
    delete store.refresh[refresh]
    store.tokens[access] = {
      userId: ref.userId,
      refreshToken: newRefresh,
      createdAt: now,
      expiresAt: now + accessTtlMs,
    }
    store.refresh[newRefresh] = { accessToken: access, userId: ref.userId }
    saveYandexStore(store)
    logYandexAccess(`OAUTH token 200 grant=refresh_token user=${ref.userId} via=${basic ? "basic" : "body"}`)
    return NextResponse.json({
      access_token: access,
      refresh_token: newRefresh,
      token_type: "bearer",
      expires_in: Math.floor(accessTtlMs / 1000),
    })
  }

  if (grant === "client_credentials") {
    const access = newToken()
    const refresh = newToken()
    store.tokens[access] = {
      userId: YANDEX_USER_ID,
      refreshToken: refresh,
      createdAt: now,
      expiresAt: now + accessTtlMs,
    }
    store.refresh[refresh] = { accessToken: access, userId: YANDEX_USER_ID }
    saveYandexStore(store)
    logYandexAccess(`OAUTH token 200 grant=client_credentials via=${basic ? "basic" : "body"}`)
    return NextResponse.json({
      access_token: access,
      refresh_token: refresh,
      token_type: "bearer",
      expires_in: Math.floor(accessTtlMs / 1000),
    })
  }

  return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 })
}
