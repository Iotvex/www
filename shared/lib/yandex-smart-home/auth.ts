import fs from "fs"
import path from "path"
import { NextResponse } from "next/server"
import { extractServiceToken } from "@/shared/lib/api-auth"
import { loadYandexStore } from "./config"

function extractAccessToken(request: Request): string {
  const auth = request.headers.get("authorization") || ""
  const m = auth.match(/^(?:Bearer|OAuth)\s+(.+)$/i)
  return (m?.[1] || extractServiceToken(request) || "").trim()
}

/**
 * Validate Yandex Smart Home access token (Bearer / OAuth) or service token for local tests.
 */
export function authorizeYandex(request: Request): { ok: true; userId: string } | { ok: false; status: number } {
  const token = extractAccessToken(request)
  if (!token) return { ok: false, status: 401 }

  const store = loadYandexStore()
  const row = store.tokens[token]
  if (row && row.expiresAt > Date.now()) {
    return { ok: true, userId: row.userId }
  }

  const service = (process.env.IOTVEX_SERVICE_TOKEN || "").trim()
  if (service && token === service) {
    return { ok: true, userId: "iotvex-home" }
  }

  return { ok: false, status: 401 }
}

/** Append one line to config/yandex-access.log (best-effort). */
export function logYandexAccess(line: string): void {
  try {
    const dir = process.env.IOTVEX_CONFIG_DIR || path.join(process.cwd(), "config")
    fs.appendFileSync(path.join(dir, "yandex-access.log"), `${new Date().toISOString()} ${line}\n`, {
      encoding: "utf8",
    })
  } catch {
    /* ignore */
  }
}

export function yandexJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  })
}

export { extractAccessToken }
