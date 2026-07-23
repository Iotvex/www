"use client"

import { $viewId, setView } from "@/entities/nav/model/store"
import { NAV_SECTIONS } from "@/shared/config/navigation"
import { cn } from "@/shared/lib/utils"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { useUnit } from "effector-react"
import { useTranslations } from "next-intl"

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const current = useUnit($viewId)
  const tNav = useTranslations("nav")
  const tSidebar = useTranslations("sidebar")

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current">
            <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight text-sidebar-foreground">Iotvex</div>
          <div className="text-[11px] text-muted-foreground">{tSidebar("panelControlSubtitle")}</div>
        </div>
      </div>
      <ScrollArea className="flex-1 px-2 py-3">
        <div className="space-y-4">
          {NAV_SECTIONS.map((section, sectionIndex) => (
            <div key={section.id}>
              {sectionIndex > 0 ? (
                <div className="mb-3 px-3">
                  <div className="h-px bg-white/10" />
                </div>
              ) : null}
              {section.sectionKey ? (
                <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {tNav(`sections.${section.sectionKey}`)}
                </div>
              ) : null}
              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const active = current === item.id
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(e) => {
                        setView(item.id)
                        onNavigate?.()
                        e.currentTarget.blur()
                      }}
                      className={cn(
                        "flex w-full min-h-9 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-ring/40",
                        active
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{tNav(`items.${item.id}`)}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>
      </ScrollArea>
    </>
  )
}

export function AppSidebar() {
  return (
    <aside className="iotvex-sidebar-enter hidden h-full w-60 shrink-0 flex-col border-r border-white/10 bg-black/40 text-sidebar-foreground backdrop-blur-xl md:flex">
      <SidebarNav />
    </aside>
  )
}
