"use client"

import { useColorTheme } from "@/app/providers/color-theme-provider"
import { useLocaleSwitch } from "@/app/providers/locale-provider"
import {
  enableRemotePreferences,
  fetchPreferencesRemote,
  persistPreferences,
  readLocalPreferences,
  withRemoteSuppressed,
  writeLocalPreferences,
  type ThemeMode,
} from "@/shared/lib/user-preferences"
import { useTheme } from "next-themes"
import { useEffect, useRef, type FC, type PropsWithChildren } from "react"

/**
 * After login: load theme / accent / locale from Supabase and apply.
 * On change: localStorage immediately, debounced upsert to DB.
 * If offline briefly, local cache remains the source until sync succeeds.
 */
const PreferencesSync: FC<PropsWithChildren<{ userId: string | null }>> = ({
  userId,
  children,
}) => {
  const { theme, setTheme } = useTheme()
  const { color, setColor } = useColorTheme()
  const { locale, setLocale } = useLocaleSwitch()
  const hydratedFor = useRef<string | null>(null)
  const skipThemeEcho = useRef(false)

  useEffect(() => {
    enableRemotePreferences(Boolean(userId))
    if (!userId) {
      hydratedFor.current = null
      return
    }

    let cancelled = false
    void (async () => {
      const remote = await fetchPreferencesRemote()
      if (cancelled) return

      if (!remote) {
        const local = readLocalPreferences()
        const seedTheme: ThemeMode =
          local.theme ||
          (theme === "light" || theme === "dark" || theme === "system" ? theme : "system")
        persistPreferences({
          theme: seedTheme,
          color_theme: local.color_theme || color,
          locale: local.locale || locale,
        })
        hydratedFor.current = userId
        return
      }

      withRemoteSuppressed(() => {
        writeLocalPreferences(remote)
        skipThemeEcho.current = true
        if (remote.theme) setTheme(remote.theme)
        if (remote.color_theme && remote.color_theme !== color) setColor(remote.color_theme)
        if (remote.locale && remote.locale !== locale) setLocale(remote.locale)
      })
      hydratedFor.current = userId
    })()

    return () => {
      cancelled = true
    }
    // Only re-hydrate when the session user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Persist theme mode changes (next-themes owns its own storage key).
  useEffect(() => {
    if (!userId || hydratedFor.current !== userId) return
    if (theme !== "light" && theme !== "dark" && theme !== "system") return
    if (skipThemeEcho.current) {
      skipThemeEcho.current = false
      return
    }
    persistPreferences({ theme })
  }, [theme, userId])

  return children
}

PreferencesSync.displayName = "PreferencesSync"

export { PreferencesSync }
