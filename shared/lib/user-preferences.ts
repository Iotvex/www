import {
  COLOR_STORAGE_KEY,
  COLOR_THEMES,
  type ColorThemeId,
} from "@/shared/config/themes"
import { isAppLocale, localeCookieName, type AppLocale } from "@/i18n/config"

export type ThemeMode = "light" | "dark" | "system"

export type UserPreferences = {
  theme: ThemeMode
  color_theme: ColorThemeId
  locale: AppLocale
}

export const THEME_STORAGE_KEY = "theme"

const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"]

let remoteEnabled = false
let suppressRemote = false
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingPatch: Partial<UserPreferences> = {}

export function isThemeMode(value: string): value is ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value)
}

export function isColorThemeId(value: string): value is ColorThemeId {
  return COLOR_THEMES.some((t) => t.id === value)
}

export function enableRemotePreferences(enabled: boolean) {
  remoteEnabled = enabled
  if (!enabled && saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    pendingPatch = {}
  }
}

export function withRemoteSuppressed<T>(fn: () => T): T {
  suppressRemote = true
  try {
    return fn()
  } finally {
    suppressRemote = false
  }
}

/** Read cached prefs from localStorage / cookie (offline-friendly). */
export function readLocalPreferences(): Partial<UserPreferences> {
  if (typeof window === "undefined") return {}
  const out: Partial<UserPreferences> = {}
  try {
    const theme = localStorage.getItem(THEME_STORAGE_KEY)
    if (theme && isThemeMode(theme)) out.theme = theme
    const color = localStorage.getItem(COLOR_STORAGE_KEY)
    if (color && isColorThemeId(color)) out.color_theme = color
    const locale = localStorage.getItem(localeCookieName)
    if (locale && isAppLocale(locale)) out.locale = locale
  } catch {
    /* ignore */
  }
  return out
}

/** Persist prefs locally (always) — used as offline cache / FOUC boot. */
export function writeLocalPreferences(patch: Partial<UserPreferences>) {
  if (typeof window === "undefined") return
  try {
    if (patch.theme && isThemeMode(patch.theme)) {
      localStorage.setItem(THEME_STORAGE_KEY, patch.theme)
    }
    if (patch.color_theme && isColorThemeId(patch.color_theme)) {
      localStorage.setItem(COLOR_STORAGE_KEY, patch.color_theme)
    }
    if (patch.locale && isAppLocale(patch.locale)) {
      localStorage.setItem(localeCookieName, patch.locale)
      document.cookie = `${localeCookieName}=${patch.locale}; path=/; max-age=31536000; samesite=lax`
    }
  } catch {
    /* ignore */
  }
}

function scheduleRemoteSave(patch: Partial<UserPreferences>) {
  if (!remoteEnabled || suppressRemote) return
  pendingPatch = { ...pendingPatch, ...patch }
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const body = pendingPatch
    pendingPatch = {}
    saveTimer = null
    void savePreferencesRemote(body).catch(() => {
      /* offline / transient — local cache already written */
    })
  }, 350)
}

/** Local write + debounced remote upsert when logged in. */
export function persistPreferences(patch: Partial<UserPreferences>) {
  writeLocalPreferences(patch)
  scheduleRemoteSave(patch)
}

export async function fetchPreferencesRemote(): Promise<UserPreferences | null> {
  try {
    const res = await fetch("/api/preferences", { cache: "no-store" })
    if (!res.ok) return null
    const data = (await res.json()) as { preferences?: Partial<UserPreferences> | null }
    const p = data.preferences
    if (!p) return null
    const out: Partial<UserPreferences> = {}
    if (p.theme && isThemeMode(p.theme)) out.theme = p.theme
    if (p.color_theme && isColorThemeId(p.color_theme)) out.color_theme = p.color_theme
    if (p.locale && isAppLocale(p.locale)) out.locale = p.locale
    if (!out.theme && !out.color_theme && !out.locale) return null
    return {
      theme: out.theme || "system",
      color_theme: out.color_theme || "default",
      locale: out.locale || "en",
    }
  } catch {
    return null
  }
}

export async function savePreferencesRemote(patch: Partial<UserPreferences>): Promise<void> {
  const body: Record<string, string> = {}
  if (patch.theme) body.theme = patch.theme
  if (patch.color_theme) body.color_theme = patch.color_theme
  if (patch.locale) body.locale = patch.locale
  if (!Object.keys(body).length) return
  const res = await fetch("/api/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`preferences save failed: ${res.status}`)
}

export function normalizePreferencesRow(row: {
  theme?: string | null
  color_theme?: string | null
  locale?: string | null
} | null): UserPreferences | null {
  if (!row) return null
  return {
    theme: row.theme && isThemeMode(row.theme) ? row.theme : "system",
    color_theme: row.color_theme && isColorThemeId(row.color_theme) ? row.color_theme : "default",
    locale: row.locale && isAppLocale(row.locale) ? row.locale : "en",
  }
}
