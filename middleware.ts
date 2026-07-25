import { type NextRequest, NextResponse } from "next/server"
import { authorizeApiRequest, isPublicApiPath } from "@/shared/lib/api-auth"
import { updateSession } from "@/shared/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isAssetOrApi =
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

  // Gate /api/* — session cookie or service token (except login/logout/cron)
  if (path.startsWith("/api/") && !isPublicApiPath(path)) {
    const ok = await authorizeApiRequest(request)
    if (!ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
}
