import { type NextRequest, NextResponse } from "next/server"
import { authorizeApiRequest, isPublicApiPath } from "@/shared/lib/api-auth"
import { updateSession } from "@/shared/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Dialogs may send /v1.0/v1.0/* when Endpoint URL still includes /v1.0.
  // next.config rewrites handle this; keep path public here too.
  const isYandexSmartHome =
    path === "/v1.0" ||
    path.startsWith("/v1.0/") ||
    path.startsWith("/oauth/")
  const isAssetOrApi =
    isYandexSmartHome ||
    path.startsWith("/api/") ||
    path.startsWith("/supabase") ||
    path.startsWith("/_next") ||
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path === "/sw.js" ||
    path === "/manifest.webmanifest" ||
    path.startsWith("/icon-") ||
    /\.[a-zA-Z0-9]+$/.test(path)

  // Single-page shell: never expose section URLs
  if (!isAssetOrApi && path !== "/") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    url.hash = ""
    return NextResponse.redirect(url)
  }

  // Yandex Smart Home + OAuth: Bearer handled in route handlers (no session gate).
  // Do not touch Node fs here — middleware runs on Edge.
  if (isYandexSmartHome) {
    return NextResponse.next()
  }

  // Refresh session cookies first so the API gate sees a valid access token.
  const sessionResponse = await updateSession(request)

  // Gate /api/* — session cookie or service token (except login/logout/cron)
  if (path.startsWith("/api/") && !isPublicApiPath(path)) {
    const ok = await authorizeApiRequest(request)
    if (!ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  return sessionResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
}
