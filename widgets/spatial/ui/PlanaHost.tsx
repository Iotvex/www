"use client"

import { useMemo } from "react"
import { PlanaEditor, createFlatWorld } from "plana"

/** Client-only plana editor mount. */
export default function PlanaHost() {
  const world = useMemo(() => createFlatWorld(), [])
  return (
    <div className="absolute inset-0 [&_.plana-editor]:h-full [&_.plana-editor]:min-h-0 [&_.plana-editor]:w-full">
      <PlanaEditor world={world} />
    </div>
  )
}
