"use client"

import { $user } from "@/entities/auth/model/store"
import { LanguageSwitcherCompact } from "@/features/locale/ui/LanguageSwitcher"
import { ThemeSwitcher } from "@/features/theme/ui/ThemeSwitcher"
import { Button } from "@/shared/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet"
import { SidebarNav } from "@/widgets/sidebar/ui/AppSidebar"
import { useUnit } from "effector-react"
import { Menu } from "lucide-react"
import { useTranslations } from "next-intl"

export function Topbar({
  title,
  subtitle,
  navOpen,
  onNavOpenChange,
}: {
  title: string
  subtitle?: string
  navOpen: boolean
  onNavOpenChange: (open: boolean) => void
}) {
  const user = useUnit($user)
  const t = useTranslations("topbar")

  return (
    <header className="z-30 shrink-0 border-b border-white/[0.06] bg-black/92 backdrop-blur-xl">
      {/* No pt-safe: apple statusBarStyle "black" already insets the webview. */}
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Sheet open={navOpen} onOpenChange={onNavOpenChange}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 md:hidden"
                aria-label={t("menu")}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="gap-0 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>{t("navigation")}</SheetTitle>
              </SheetHeader>
              <div className="flex h-full flex-col">
                <SidebarNav onNavigate={() => onNavOpenChange(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
              {title}
            </h1>
            {subtitle ? (
              <p className="hidden truncate text-xs text-muted-foreground sm:block">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <ThemeSwitcher compact />
          <span className="hidden max-w-[9rem] truncate text-xs text-muted-foreground xl:inline">
            {user?.email}
          </span>
          <LanguageSwitcherCompact />
        </div>
      </div>
    </header>
  )
}
