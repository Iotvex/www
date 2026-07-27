"use client"

import { useEffect, useState } from "react"
import { SpatialEngine, type SpatialEngineOptions } from "../../core/engine"

/** Create a stable engine instance for the lifetime of the host view. */
export function useSpatialEngine(options?: SpatialEngineOptions): SpatialEngine | null {
  const [engine, setEngine] = useState<SpatialEngine | null>(null)

  useEffect(() => {
    const inst = SpatialEngine.create(options)
    setEngine(inst)
    return () => inst.dispose()
    // intentionally once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return engine
}
