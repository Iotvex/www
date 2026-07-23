"use client"

import { PreferencesSync } from "@/app/providers/preferences-sync"
import { setUser, type AuthUser } from "@/entities/auth/model/store"
import {
  fetchAgentHealthFx,
  fetchCatalogFx,
  fetchNodeFx,
} from "@/entities/device/model/store"
import { FC, PropsWithChildren, useEffect } from "react"

const POLL_MS = 5000

const AuthProvider: FC<PropsWithChildren<{ user: AuthUser | null }>> = ({ user, children }) => {
  const userId = user?.id ?? null

  useEffect(() => {
    setUser(user)
  }, [user])

  // Agent reachability must not depend on catalog / strip decode.
  // Poll whenever a session exists (stable user id, not object identity).
  // Dashboard is auth-gated — without user we never show agent offline UI.
  useEffect(() => {
    if (!userId) return

    let cancelled = false
    const tick = () => {
      if (cancelled) return
      void fetchAgentHealthFx()
      void fetchNodeFx()
    }

    void fetchCatalogFx()
    tick()
    const id = window.setInterval(tick, POLL_MS)
    // Immediate retry once in case the first paint raced a cold start.
    const retry = window.setTimeout(tick, 1500)

    // Mobile Safari / PWA: timers freeze in background — refresh on resume.
    const onVisible = () => {
      if (document.visibilityState === "visible") tick()
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) tick()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("pageshow", onPageShow)

    return () => {
      cancelled = true
      window.clearInterval(id)
      window.clearTimeout(retry)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [userId])

  return <PreferencesSync userId={userId}>{children}</PreferencesSync>
}

AuthProvider.displayName = "AuthProvider"

export { AuthProvider }
