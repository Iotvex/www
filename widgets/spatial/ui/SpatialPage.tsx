"use client"

import { useEffect, useState } from "react"
import {
  Box,
  Circle,
  Cylinder,
  Redo2,
  Square,
  Undo2,
  Move3d,
  Axis3d,
  Focus,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import {
  SpatialViewport,
  useSpatialEngine,
  type CameraMode,
  type NodeId,
  vec3,
} from "@/features/spatial-engine"
import { useTranslations } from "next-intl"

/**
 * Host chrome around the domain-agnostic Spatial Engine.
 * Wire devices/entities later via node metadata — not here.
 */
export function SpatialPage() {
  const t = useTranslations("views.spatial")
  const engine = useSpatialEngine({ seedDemo: true })
  const [selection, setSelection] = useState<NodeId[]>([])
  const [camMode, setCamMode] = useState<CameraMode>("orbit")
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    if (!engine) return
    const offs = [
      engine.bus.on("selection:changed", ({ ids }) => setSelection(ids)),
      engine.bus.on("camera:mode-changed", ({ mode }) => setCamMode(mode as CameraMode)),
      engine.bus.on("history:changed", ({ canUndo: u, canRedo: r }) => {
        setCanUndo(u)
        setCanRedo(r)
      }),
    ]
    return () => offs.forEach((off) => off())
  }, [engine])

  if (!engine) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-muted-foreground">
        {t("loading")}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col gap-3 md:h-[calc(100%-0.25rem)] md:min-h-[32rem]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-2 text-sm text-muted-foreground">{t("subtitle")}</div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            engine.addPrimitive("box", "Box", vec3(Math.random() * 4 - 2, 0.5, Math.random() * 4 - 2), {
              createdBy: "spatial-ui",
            })
          }
        >
          <Box className="mr-1.5 h-4 w-4" />
          Box
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            engine.addPrimitive("cylinder", "Cylinder", vec3(Math.random() * 4 - 2, 0.6, Math.random() * 4 - 2))
          }
        >
          <Cylinder className="mr-1.5 h-4 w-4" />
          Cylinder
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            engine.addPrimitive("sphere", "Sphere", vec3(Math.random() * 4 - 2, 0.55, Math.random() * 4 - 2))
          }
        >
          <Circle className="mr-1.5 h-4 w-4" />
          Sphere
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => engine.addPrimitive("plane", "Plane", vec3(0, 0.02, 0))}
        >
          <Square className="mr-1.5 h-4 w-4" />
          Plane
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button size="sm" variant="outline" disabled={!canUndo} onClick={() => engine.undo()}>
          <Undo2 className="mr-1.5 h-4 w-4" />
          Undo
        </Button>
        <Button size="sm" variant="outline" disabled={!canRedo} onClick={() => engine.redo()}>
          <Redo2 className="mr-1.5 h-4 w-4" />
          Redo
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          size="sm"
          variant={camMode === "orbit" ? "default" : "outline"}
          onClick={() => engine.camera.setMode("orbit")}
        >
          <Move3d className="mr-1.5 h-4 w-4" />
          Orbit
        </Button>
        <Button
          size="sm"
          variant={camMode === "ortho-top" ? "default" : "outline"}
          onClick={() => engine.camera.setMode("ortho-top")}
        >
          <Axis3d className="mr-1.5 h-4 w-4" />
          Top
        </Button>
        <Button
          size="sm"
          variant={camMode === "fly" ? "default" : "outline"}
          onClick={() => engine.camera.setMode("fly")}
        >
          <Focus className="mr-1.5 h-4 w-4" />
          Fly
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">
          {selection.length
            ? t("selected", { count: selection.length })
            : t("hint")}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-black/40">
        <SpatialViewport engine={engine} className="absolute inset-0" />
      </div>
    </div>
  )
}
