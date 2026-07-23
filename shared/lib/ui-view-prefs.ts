"use client"

import { useCallback, useEffect, useState } from "react"

export type EntityViewSort = "name_asc" | "name_desc" | "domain" | "active" | "device"
export type EntityViewPrefs = {
  groupByDevice: boolean
  sort: EntityViewSort
}

const STORAGE_KEY = "iotvex.entityView.v1"
const DEFAULTS: EntityViewPrefs = { groupByDevice: true, sort: "device" }

function readPrefs(): EntityViewPrefs {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<EntityViewPrefs>
    return {
      groupByDevice: parsed.groupByDevice ?? DEFAULTS.groupByDevice,
      sort: (parsed.sort as EntityViewSort) || DEFAULTS.sort,
    }
  } catch {
    return DEFAULTS
  }
}

export function useEntityViewPrefs() {
  const [prefs, setPrefs] = useState<EntityViewPrefs>(DEFAULTS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setPrefs(readPrefs())
    setReady(true)
  }, [])

  const update = useCallback((patch: Partial<EntityViewPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { prefs, ready, update }
}

export type DashboardWidgetViewPrefs = {
  groupByDevice: boolean
}

const DASH_KEY = "iotvex.dashboardEntityView.v1"

export function useDashboardEntityViewPrefs() {
  const [prefs, setPrefs] = useState<DashboardWidgetViewPrefs>({ groupByDevice: true })

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DASH_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DashboardWidgetViewPrefs>
        setPrefs({ groupByDevice: parsed.groupByDevice ?? true })
      }
    } catch {
      /* ignore */
    }
  }, [])

  const update = useCallback((patch: Partial<DashboardWidgetViewPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      try {
        window.localStorage.setItem(DASH_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { prefs, update }
}
