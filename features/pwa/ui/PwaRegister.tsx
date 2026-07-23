"use client"

import { useEffect } from "react"

const SW_URL = "/sw.js"

/**
 * Register the PWA service worker without a reload loop.
 *
 * The previous pattern (skipWaiting → clients.claim → reload on
 * controllerchange) caused Safari browser tabs to reboot endlessly.
 * Standalone PWA often looked fine because the update race differs.
 *
 * Navigations are not intercepted (SW v7+). /_next/static is network-first.
 * Quiet activation is enough — fresh code arrives on the next navigation.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    let cancelled = false

    const register = () => {
      navigator.serviceWorker
        .register(SW_URL, { updateViaCache: "none" })
        .then((reg) => {
          if (cancelled) return
          // Background update check only — never skipWaiting + reload here.
          void reg.update()
        })
        .catch(() => {
          /* ignore */
        })
    }

    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
