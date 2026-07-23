"use client"

import { $viewId, getViewMeta } from "@/entities/nav/model/store"
import { useEdgeSwipe } from "@/features/mobile-shell/useEdgeSwipe"
import { AppSidebar } from "@/widgets/sidebar/ui/AppSidebar"
import { MobileNav } from "@/widgets/shell/ui/MobileNav"
import { Topbar } from "@/widgets/topbar/ui/Topbar"
import { ViewHost } from "@/widgets/shell/ui/ViewHost"
import { useUnit } from "effector-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

export function DashboardApp() {
  const viewId = useUnit($viewId)
  const view = getViewMeta(viewId)
  const tViews = useTranslations("views")
  const title = tViews(`${viewId}.title`)
  const [navOpen, setNavOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    document.title = `${title} · Iotvex`
  }, [title])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.pathname !== "/") {
      window.history.replaceState(null, "", "/")
    }
  }, [])

  // iOS standalone: first paint can leave a phantom top offset until a fixed
  // overlay / scroll-lock cycle (hamburger Sheet) reflows the viewport.
  // Body is pinned via CSS; this only nudges visualViewport + scroll to 0.
  useEffect(() => {
    if (typeof window === "undefined") return
    const nav = window.navigator as Navigator & { standalone?: boolean }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      nav.standalone === true
    if (!standalone) return

    const settle = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
    settle()
    const raf = window.requestAnimationFrame(settle)
    const t = window.setTimeout(settle, 50)
    const vv = window.visualViewport
    vv?.addEventListener("resize", settle)
    vv?.addEventListener("scroll", settle)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t)
      vv?.removeEventListener("resize", settle)
      vv?.removeEventListener("scroll", settle)
    }
  }, [])

  const blurActive = useCallback(() => {
    const el = document.activeElement
    if (el instanceof HTMLElement) el.blur()
  }, [])

  const onOpen = useCallback(() => {
    blurActive()
    setNavOpen(true)
  }, [blurActive])
  const onClose = useCallback(() => {
    blurActive()
    setNavOpen(false)
  }, [blurActive])

  useEdgeSwipe({
    open: navOpen,
    onOpen,
    onClose,
    enabled: isMobile,
  })

  return (
    <div className="iotvex-shell relative flex overflow-hidden overscroll-none bg-background text-foreground touch-pan-y">
      <div className="iotvex-atmosphere" aria-hidden>
        <span className="iotvex-orb iotvex-orb-a" />
        <span className="iotvex-orb iotvex-orb-b" />
        <span className="iotvex-orb iotvex-orb-c" />
        <span className="iotvex-orb iotvex-orb-d" />
      </div>
      <div className="relative z-10 flex h-full w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col pl-safe pr-safe">
          <Topbar
            title={title}
            navOpen={navOpen}
            onNavOpenChange={(open) => {
              blurActive()
              setNavOpen(open)
            }}
          />
          {/* No top safe-area: opaque status bar already insets. Bottom: home indicator. */}
          <main className="iotvex-hide-scroll min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 pt-3 pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:pt-4 md:px-6 md:pt-6 md:pb-6">
            <ViewHost viewId={viewId} />
          </main>
        </div>
        <MobileNav />
      </div>
    </div>
  )
}
