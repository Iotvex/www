import { createHash, randomBytes } from "crypto"
import fs from "fs"
import path from "path"

export type YandexOauthStore = {
  version: 1
  clientId: string
  clientSecret: string
  codes: Record<string, { userId: string; redirectUri: string; createdAt: number; expiresAt: number }>
  tokens: Record<
    string,
    { userId: string; refreshToken: string; createdAt: number; expiresAt: number }
  >
  refresh: Record<string, { accessToken: string; userId: string }>
}

function configDir(): string {
  if (process.env.IOTVEX_CONFIG_DIR) return process.env.IOTVEX_CONFIG_DIR
  return path.join(process.cwd(), "config")
}

export function yandexConfigPath(): string {
  return path.join(configDir(), "yandex-smart-home.json")
}

function defaultStore(): YandexOauthStore {
  return {
    version: 1,
    clientId: process.env.IOTVEX_YANDEX_CLIENT_ID?.trim() || "iotvex-yandex",
    clientSecret:
      process.env.IOTVEX_YANDEX_CLIENT_SECRET?.trim() ||
      createHash("sha256").update(`iotvex-yandex-${process.env.IOTVEX_SERVICE_TOKEN || "dev"}`).digest("hex").slice(0, 32),
    codes: {},
    tokens: {},
    refresh: {},
  }
}

export function loadYandexStore(): YandexOauthStore {
  const p = yandexConfigPath()
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as YandexOauthStore
    if (!raw?.version) return defaultStore()
    return {
      ...defaultStore(),
      ...raw,
      codes: raw.codes || {},
      tokens: raw.tokens || {},
      refresh: raw.refresh || {},
    }
  } catch {
    const store = defaultStore()
    saveYandexStore(store)
    return store
  }
}

export function saveYandexStore(store: YandexOauthStore): void {
  const p = yandexConfigPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const tmp = `${p}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2) + "\n", { mode: 0o666 })
  fs.renameSync(tmp, p)
  try {
    fs.chmodSync(p, 0o666)
  } catch {
    /* ignore */
  }
}

export function newToken(): string {
  return randomBytes(24).toString("hex")
}

/** LED brightness ceiling while testing / voice control (0–255). */
export const LED_BRIGHTNESS_CAP = Math.round(255 * 0.7)

export const YANDEX_USER_ID = "iotvex-home"
