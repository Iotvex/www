"use client"

import { useColorTheme } from "@/app/providers/color-theme-provider"
import { LanguageSwitcher } from "@/features/locale/ui/LanguageSwitcher"
import { COLOR_THEMES, MODE_OPTIONS } from "@/shared/config/themes"
import { Button } from "@/shared/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import { cn } from "@/shared/lib/utils"
import { Check, Moon, Palette, Sun, Monitor } from "lucide-react"
import { useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

const modeIcon = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const

function CompactThemeSwitcher() {
  const t = useTranslations("theme")
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const ModeIcon = mounted
    ? modeIcon[(theme as keyof typeof modeIcon) || "system"] || Palette
    : Palette

  const cycle = () => {
    const order = ["system", "light", "dark"] as const
    const current = (theme as (typeof order)[number]) || "system"
    const idx = order.indexOf(current)
    setTheme(order[(idx + 1) % order.length])
  }

  return (
    <Button type="button" variant="ghost" size="icon" aria-label={t("ariaLabel")} onClick={cycle}>
      <ModeIcon className="h-4 w-4" />
    </Button>
  )
}

function FullThemeSwitcher() {
  const t = useTranslations("theme")
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const ModeIcon = mounted
    ? modeIcon[(theme as keyof typeof modeIcon) || "system"] || Palette
    : Palette

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-2" aria-label={t("ariaLabel")}>
          <ModeIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{t("buttonLabel")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t("modeLabel")}</DropdownMenuLabel>
        {MODE_OPTIONS.map((m) => {
          const Icon = modeIcon[m.id]
          const active = mounted && theme === m.id
          return (
            <DropdownMenuItem key={m.id} onClick={() => setTheme(m.id)}>
              <Icon className="h-4 w-4" />
              <span className="flex-1">{t(`modes.${m.id}`)}</span>
              {active ? <Check className="h-4 w-4 text-muted-foreground" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  if (compact) return <CompactThemeSwitcher />
  return <FullThemeSwitcher />
}

export function AppearancePanel() {
  const t = useTranslations("theme")
  const tSettings = useTranslations("settings")
  const { theme, setTheme } = useTheme()
  const { color, setColor } = useColorTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold tracking-tight">{tSettings("appearance.title")}</h2>
        <p className="text-xs text-muted-foreground">{tSettings("appearance.description")}</p>
      </div>
      <div>
        <div className="mb-2 text-sm font-medium">{t("themeTitle")}</div>
        <div className="grid grid-cols-3 gap-2">
          {MODE_OPTIONS.map((m) => {
            const Icon = modeIcon[m.id]
            const active = mounted && theme === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setTheme(m.id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-xs outline-none transition-colors",
                  active
                    ? "border-border bg-muted text-foreground"
                    : "border-border/60 bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                {t(`modes.${m.id}`)}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <div className="mb-2 text-sm font-medium">{t("accentColor")}</div>
        <div className="flex flex-wrap gap-2">
          {COLOR_THEMES.map((themeItem) => {
            const active = color === themeItem.id
            return (
              <button
                key={themeItem.id}
                type="button"
                title={t(`colors.${themeItem.id}`)}
                onClick={() => setColor(themeItem.id)}
                className={cn(
                  "h-7 w-7 rounded-full border outline-none transition",
                  active ? "border-foreground/70 ring-1 ring-foreground/25" : "border-border/70",
                )}
                style={{ background: themeItem.swatch }}
              >
                <span className="sr-only">{t(`colors.${themeItem.id}`)}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="space-y-1 border-t border-border/50 pt-6">
        <h2 className="text-sm font-semibold tracking-tight">{tSettings("language.title")}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{tSettings("language.description")}</p>
        <LanguageSwitcher />
      </div>
    </div>
  )
}
