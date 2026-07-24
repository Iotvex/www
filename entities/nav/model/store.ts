"use client"

import { createEvent, createStore } from "effector"

export type AppViewId =
  | "dashboard"
  | "home-devices"
  | "home-entities"
  | "home-areas"
  | "auto-scenarios"
  | "auto-scenes"
  | "auto-scripts"
  | "activity"
  | "modules"
  | "assistant"
  | "settings-account"
  | "settings-appearance"
  | "settings-services"
  | "settings-users"
  | "settings-backup"
  | "settings-tools"

export type AppViewGroup = "overview" | "home" | "automation" | "system" | "settings"

export type AppViewMeta = {
  id: AppViewId
  group: AppViewGroup
}

export const APP_VIEWS: AppViewMeta[] = [
  { id: "dashboard", group: "overview" },
  { id: "home-devices", group: "home" },
  { id: "home-entities", group: "home" },
  { id: "home-areas", group: "home" },
  { id: "auto-scenarios", group: "automation" },
  { id: "auto-scenes", group: "automation" },
  { id: "auto-scripts", group: "automation" },
  { id: "activity", group: "system" },
  { id: "modules", group: "system" },
  { id: "assistant", group: "system" },
  { id: "settings-account", group: "settings" },
  { id: "settings-appearance", group: "settings" },
  { id: "settings-services", group: "settings" },
  { id: "settings-users", group: "settings" },
  { id: "settings-backup", group: "settings" },
  { id: "settings-tools", group: "settings" },
]

const LEGACY: Record<string, AppViewId> = {
  home: "home-devices",
  rules: "auto-scenarios",
  settings: "settings-account",
  inventory: "home-devices",
}

const KEY = "iotvex-view"
const GROUP_KEY = "iotvex-view-group"

function isViewId(v: string): v is AppViewId {
  return APP_VIEWS.some((x) => x.id === v)
}

function readInitial(): AppViewId {
  if (typeof window === "undefined") return "dashboard"
  try {
    const v = sessionStorage.getItem(KEY)
    if (v && isViewId(v)) return v
    if (v && LEGACY[v]) return LEGACY[v]
  } catch {
    /* ignore */
  }
  return "dashboard"
}

export const setView = createEvent<AppViewId>()
export const $viewId = createStore<AppViewId>(readInitial()).on(setView, (_, id) => id)

setView.watch((id) => {
  try {
    sessionStorage.setItem(KEY, id)
    const meta = getViewMeta(id)
    sessionStorage.setItem(`${GROUP_KEY}:${meta.group}`, id)
  } catch {
    /* ignore */
  }
})

export function getViewMeta(id: AppViewId): AppViewMeta {
  return APP_VIEWS.find((v) => v.id === id) || APP_VIEWS[0]
}

export function getGroupViews(group: AppViewGroup): AppViewMeta[] {
  return APP_VIEWS.filter((v) => v.group === group)
}

export function resolveGroupView(group: AppViewGroup): AppViewId {
  if (typeof window === "undefined") {
    return getGroupViews(group)[0]?.id || "dashboard"
  }
  try {
    const saved = sessionStorage.getItem(`${GROUP_KEY}:${group}`)
    if (saved && isViewId(saved) && getViewMeta(saved).group === group) return saved
  } catch {
    /* ignore */
  }
  return getGroupViews(group)[0]?.id || "dashboard"
}

export function isInGroup(id: AppViewId, group: AppViewGroup) {
  return getViewMeta(id).group === group
}
