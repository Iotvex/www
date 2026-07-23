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
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t border-white/[0.06] bg-black/92 backdrop-blur-xl md:hidden pl-safe pr-safe"
      style={{ height: "calc(3.25rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="relative mx-auto grid w-full max-w-lg grid-cols-4 items-center gap-0.5 px-1">
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
                "flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-medium outline-none transition-colors duration-150",
                "focus-visible:ring-1 focus-visible:ring-ring/40",
                active
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-6 w-6 shrink-0" strokeWidth={1.75} />
              <span className="max-w-full truncate leading-none">{t(tab.labelKey)}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
