"use client"

import type { AppViewId } from "@/entities/nav/model/store"
import { InventoryPage } from "@/widgets/inventory/ui/InventoryPage"
import { RulesPage } from "@/widgets/rules/ui/RulesPage"
import { OverviewPage } from "@/widgets/overview/ui/OverviewPage"
import { ActivityPage } from "@/widgets/activity/ui/ActivityPage"
import { ModulesPage } from "@/widgets/modules/ui/ModulesPage"
import { SettingsPage } from "@/widgets/settings/ui/SettingsPage"
import { useEffect, useState, type ReactNode } from "react"

const VIEW_COMPONENTS: Record<AppViewId, () => ReactNode> = {
  dashboard: () => <OverviewPage />,
  "home-devices": () => <InventoryPage tab="devices" />,
  "home-entities": () => <InventoryPage tab="entities" />,
  "home-areas": () => <InventoryPage tab="areas" />,
  "auto-scenarios": () => <RulesPage tab="automations" />,
  "auto-scenes": () => <RulesPage tab="scenes" />,
  "auto-scripts": () => <RulesPage tab="scripts" />,
  activity: () => <ActivityPage />,
  modules: () => <ModulesPage />,
  "settings-account": () => <SettingsPage tab="account" />,
  "settings-appearance": () => <SettingsPage tab="appearance" />,
  "settings-services": () => <SettingsPage tab="services" />,
  "settings-users": () => <SettingsPage tab="users" />,
  "settings-backup": () => <SettingsPage tab="backup" />,
  "settings-tools": () => <SettingsPage tab="tools" />,
}

export function ViewHost({ viewId }: { viewId: AppViewId }) {
  const [visited, setVisited] = useState<AppViewId[]>(() => [viewId])

  useEffect(() => {
    setVisited((list) => (list.includes(viewId) ? list : [...list, viewId]))
  }, [viewId])

  return (
    <div className="relative min-h-full">
      {visited.map((id) => {
        const render = VIEW_COMPONENTS[id]
        const active = id === viewId
        return (
          <section
            key={id}
            aria-hidden={!active}
            className={active ? "iotvex-view iotvex-view-active" : "iotvex-view iotvex-view-hidden"}
          >
            {render()}
          </section>
        )
      })}
    </div>
  )
}
