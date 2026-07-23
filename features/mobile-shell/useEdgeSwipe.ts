"use client"

import { useEffect, useRef } from "react"

type Options = {
  open: boolean
  onOpen: () => void
  onClose: () => void
  /** Left-edge zone for opening (px). iOS-like forgiving zone. */
  edgeWidth?: number
  /** Min horizontal distance to commit (px). */
  threshold?: number
  /** Min horizontal velocity to commit early (px/ms). */
  velocityThreshold?: number
  enabled?: boolean
}

type Axis = "undecided" | "horizontal" | "vertical"

/**
 * iOS-like drawer swipe:
 * - open: rightward swipe starting in a wide left zone
 * - close: leftward swipe while open
 * - ignores vertical scrolls once axis is locked
 * - cooldown + history suppress prevent races on rapid opposite swipes
 */
export function useEdgeSwipe({
  open,
  onOpen,
  onClose,
  edgeWidth = 72,
  threshold = 52,
  velocityThreshold = 0.45,
  enabled = true,
}: Options) {
  const openRef = useRef(open)
  const onOpenRef = useRef(onOpen)
  const onCloseRef = useRef(onClose)
  openRef.current = open
  onOpenRef.current = onOpen
  onCloseRef.current = onClose

  const startX = useRef(0)
  const startY = useRef(0)
  const startAt = useRef(0)
  const tracking = useRef(false)
  const axis = useRef<Axis>("undecided")
  const lockUntil = useRef(0)
  const pushedSheet = useRef(false)
  const suppressPop = useRef(false)

  useEffect(() => {
    // Keep history in sync without racing opposite gestures.
    if (!enabled || typeof window === "undefined") return

    if (open && !pushedSheet.current) {
      window.history.pushState({ __iotvex_sheet__: true }, "")
      pushedSheet.current = true
      return
    }

    if (!open && pushedSheet.current) {
      pushedSheet.current = false
      const st = window.history.state as { __iotvex_sheet__?: boolean } | null
      if (st?.__iotvex_sheet__) {
        // Mark the forthcoming popstate as ours so it won't re-close / fight a re-open.
        suppressPop.current = true
        window.history.back()
      }
    }
  }, [open, enabled])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return

    const onPop = () => {
      if (suppressPop.current) {
        suppressPop.current = false
        return
      }
      // Hardware/browser back while drawer is open.
      if (openRef.current) {
        pushedSheet.current = false
        lockUntil.current = performance.now() + 280
        onCloseRef.current()
      }
    }

    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const effectiveEdge = () => {
      if (typeof window === "undefined") return edgeWidth
      // Wider on large phones, never tiny: ~18vw capped.
      return Math.max(edgeWidth, Math.min(96, Math.round(window.innerWidth * 0.18)))
    }

    const reset = () => {
      tracking.current = false
      axis.current = "undecided"
      startAt.current = 0
    }

    const locked = () => performance.now() < lockUntil.current

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || locked()) {
        reset()
        return
      }
      const t = e.touches[0]
      const edge = effectiveEdge()
      const canOpen = !openRef.current && t.clientX <= edge
      const canClose = openRef.current
      if (!canOpen && !canClose) {
        reset()
        return
      }
      startX.current = t.clientX
      startY.current = t.clientY
      startAt.current = performance.now()
      tracking.current = true
      axis.current = "undecided"
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking.current) return
      const t = e.touches[0]
      const dx = t.clientX - startX.current
      const dy = t.clientY - startY.current
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)

      if (axis.current === "undecided") {
        if (absX < 8 && absY < 8) return
        if (absY > absX * 1.15) {
          axis.current = "vertical"
          tracking.current = false
          return
        }
        axis.current = "horizontal"
      }

      if (axis.current !== "horizontal") return

      // Prevent rubber-band / browser back-gesture while we own the horizontal swipe.
      if (!openRef.current && dx > 0) {
        e.preventDefault()
      } else if (openRef.current && dx < 0) {
        e.preventDefault()
      }
    }

    const commit = (dx: number, dt: number) => {
      const velocity = dt > 0 ? dx / dt : 0
      const edge = effectiveEdge()
      const startedInEdge = startX.current <= edge

      if (!openRef.current) {
        const distanceOk = dx >= threshold && startedInEdge
        const flickOk = velocity >= velocityThreshold && dx >= threshold * 0.45 && startedInEdge
        if (distanceOk || flickOk) {
          lockUntil.current = performance.now() + 320
          onOpenRef.current()
          return true
        }
        return false
      }

      const distanceOk = dx <= -threshold
      const flickOk = velocity <= -velocityThreshold && dx <= -threshold * 0.45
      if (distanceOk || flickOk) {
        lockUntil.current = performance.now() + 320
        onCloseRef.current()
        return true
      }
      return false
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking.current || axis.current === "vertical") {
        reset()
        return
      }
      if (locked()) {
        reset()
        return
      }
      const t = e.changedTouches[0]
      if (!t) {
        reset()
        return
      }
      const dx = t.clientX - startX.current
      const dt = Math.max(1, performance.now() - startAt.current)
      if (axis.current === "horizontal" || Math.abs(dx) >= 12) {
        commit(dx, dt)
      }
      reset()
    }

    const onTouchCancel = () => reset()

    document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true })
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true })
    document.addEventListener("touchend", onTouchEnd, { passive: true, capture: true })
    document.addEventListener("touchcancel", onTouchCancel, { passive: true, capture: true })

    return () => {
      document.removeEventListener("touchstart", onTouchStart, true)
      document.removeEventListener("touchmove", onTouchMove, true)
      document.removeEventListener("touchend", onTouchEnd, true)
      document.removeEventListener("touchcancel", onTouchCancel, true)
    }
  }, [enabled, edgeWidth, threshold, velocityThreshold])
}
