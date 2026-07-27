"use client"

import { useEffect, useRef } from "react"
import type { SpatialEngine } from "../../core/engine"

type Props = {
  engine: SpatialEngine
  className?: string
  onReady?: () => void
}

/**
 * Framework adapter — mounts the engine to a canvas. Host owns chrome/toolbars.
 */
export function SpatialViewport({ engine, className, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    engine.mount(canvas)
    onReady?.()

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      engine.resize(cr.width, cr.height)
    })
    ro.observe(wrap)
    engine.resize(wrap.clientWidth, wrap.clientHeight)

    const onPointer = (e: PointerEvent) => {
      if (e.button !== 0 || e.altKey) return
      const rect = canvas.getBoundingClientRect()
      const id = engine.pickAt(e.clientX, e.clientY, rect)
      if (e.shiftKey && id) engine.selection.toggle(id, true)
      else engine.select(id ? [id] : [])
    }
    canvas.addEventListener("pointerdown", onPointer)

    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault()
        engine.undo()
      } else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault()
        engine.redo()
      } else if (e.key === "Delete" || e.key === "Backspace") {
        for (const id of engine.selection.selected) engine.removeNode(id)
      } else if (e.key === "1") engine.camera.setMode("orbit")
      else if (e.key === "2") engine.camera.setMode("ortho-top")
      else if (e.key === "3") engine.camera.setMode("fly")
    }
    window.addEventListener("keydown", onKey)

    return () => {
      canvas.removeEventListener("pointerdown", onPointer)
      window.removeEventListener("keydown", onKey)
      ro.disconnect()
      engine.unmount()
    }
  }, [engine, onReady])

  return (
    <div ref={wrapRef} className={className ?? "relative h-full w-full overflow-hidden"}>
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  )
}
