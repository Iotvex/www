"use client"

import { $viewId, isInGroup, resolveGroupView, setView } from "@/entities/nav/model/store"
import { MOBILE_TABS } from "@/shared/config/navigation"
import { cn } from "@/shared/lib/utils"
import { useUnit } from "effector-react"
import { useTranslations } from "next-intl"

export function MobileNav() {
  const current = useUnit($viewId)
  const t = useTranslations("nav.mobile")

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/55 pb-safe pl-safe pr-safe backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-1.5">
        {MOBILE_TABS.map((tab) => {
          const active =
            tab.group === "settings"
              ? isInGroup(current, "settings") || isInGroup(current, "system")
              : isInGroup(current, tab.group)
          const Icon = tab.icon
          return (
            <button
              key={tab.group}
              type="button"
              onClick={(e) => {
                setView(resolveGroupView(tab.group))
                e.currentTarget.blur()
              }}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-medium outline-none transition-colors duration-150",
                "focus-visible:ring-1 focus-visible:ring-ring/40",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{t(tab.labelKey)}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
