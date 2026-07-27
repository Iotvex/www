import { NextResponse } from "next/server"
import { publicRequestOrigin } from "@/shared/lib/public-origin"
import {
  YANDEX_USER_ID,
  loadYandexStore,
  newToken,
  saveYandexStore,
} from "@/shared/lib/yandex-smart-home/config"
import { logYandexAccess } from "@/shared/lib/yandex-smart-home/auth"

export const dynamic = "force-dynamic"

const ALLOWED_REDIRECTS = new Set([
  "https://social.yandex.net/broker/redirect",
  "https://social.yandex.ru/broker/redirect",
])

function isAllowedRedirect(uri: string): boolean {
  try {
    const u = new URL(uri)
    const base = `${u.protocol}//${u.host}${u.pathname}`.replace(/\/$/, "")
    if (ALLOWED_REDIRECTS.has(uri) || ALLOWED_REDIRECTS.has(base)) return true
    // Allow exact broker redirect with no extra path segments.
    return (
      (u.hostname === "social.yandex.net" || u.hostname === "social.yandex.ru") &&
      u.pathname.replace(/\/$/, "") === "/broker/redirect"
    )
  } catch {
    return false
  }
}

/**
 * Minimal OAuth 2.0 authorize for Yandex Dialogs account linking.
 * GET /oauth/authorize?client_id=...&redirect_uri=...&response_type=code&state=...
 *
 * For a private home skill we auto-approve when client_id matches.
 * Optional: pass ?confirm=1 after showing a simple HTML consent page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const clientId = url.searchParams.get("client_id") || ""
  const redirectUri = url.searchParams.get("redirect_uri") || ""
  const responseType = url.searchParams.get("response_type") || "code"
  const state = url.searchParams.get("state") || ""
  const confirm = url.searchParams.get("confirm")

  const store = loadYandexStore()
  if (clientId && clientId !== store.clientId) {
    logYandexAccess(`OAUTH authorize 400 invalid_client id=${clientId}`)
    return NextResponse.json({ error: "invalid_client" }, { status: 400 })
  }
  if (responseType !== "code") {
    return NextResponse.json({ error: "unsupported_response_type" }, { status: 400 })
  }
  if (!redirectUri) {
    return NextResponse.json({ error: "redirect_uri required" }, { status: 400 })
  }
  if (!isAllowedRedirect(redirectUri)) {
    logYandexAccess(`OAUTH authorize 400 bad_redirect ${redirectUri}`)
    return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 })
  }

  const origin = publicRequestOrigin(request)
  if (/0\.0\.0\.0|127\.0\.0\.1|localhost/i.test(origin)) {
    logYandexAccess(`OAUTH authorize 500 bad_public_origin ${origin}`)
    return NextResponse.json(
      {
        error: "server_misconfigured",
        error_description: "Public HTTPS tunnel URL is required for Alice linking",
      },
      { status: 500 },
    )
  }

  if (!confirm) {
    // Never use request.url origin — Docker HOSTNAME=0.0.0.0 breaks absolute links.
    const approve = new URL(request.url)
    approve.searchParams.set("confirm", "1")
    const publicApprove = new URL(`${approve.pathname}${approve.search}`, `${origin}/`)
    const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"/><title>Iotvex × Алиса</title>
<style>
body{font-family:system-ui,sans-serif;background:#0f1419;color:#e8eef5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
card{background:#1a2330;padding:2rem 2.4rem;border-radius:16px;max-width:28rem;box-shadow:0 12px 40px #0008}
h1{font-size:1.35rem;margin:0 0 .5rem}
p{opacity:.85;line-height:1.45}
a.btn{display:inline-block;margin-top:1.2rem;background:#fc3f1d;color:#fff;text-decoration:none;padding:.75rem 1.25rem;border-radius:10px;font-weight:600}
</style></head><body><card>
<h1>Привязать Iotvex к Алисе</h1>
<p>Яндекс Умный дом получит доступ к лентам света и метеостанции в вашем доме Iotvex.</p>
<a class="btn" href="${publicApprove.toString().replace(/"/g, "&quot;")}">Разрешить</a>
</card></body></html>`
    logYandexAccess(`OAUTH authorize 200 consent origin=${origin}`)
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  const code = newToken()
  const now = Date.now()
  store.codes[code] = {
    userId: YANDEX_USER_ID,
    redirectUri,
    createdAt: now,
    expiresAt: now + 10 * 60 * 1000,
  }
  // prune old codes
  for (const [k, v] of Object.entries(store.codes)) {
    if (v.expiresAt < now) delete store.codes[k]
  }
  saveYandexStore(store)

  const dest = new URL(redirectUri)
  dest.searchParams.set("code", code)
  if (state) dest.searchParams.set("state", state)
  logYandexAccess(`OAUTH authorize 302 code issued origin=${origin}`)
  return NextResponse.redirect(dest.toString(), 302)
}
