"use client"

import { useLocaleSwitch } from "@/app/providers/locale-provider"
import { locales, type AppLocale } from "@/i18n/config"
import { cn } from "@/shared/lib/utils"
import { useTranslations } from "next-intl"
import { Check, Languages } from "lucide-react"

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("languages")
  const tSettings = useTranslations("settings.language")
  const { locale, setLocale, pending } = useLocaleSwitch()

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Languages className="h-4 w-4 text-muted-foreground" />
        {tSettings("label")}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {locales.map((code) => {
          const active = locale === code
          return (
            <button
              key={code}
              type="button"
              disabled={pending}
              onClick={() => setLocale(code as AppLocale)}
              className={cn(
                "flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm outline-none transition-colors",
                "focus-visible:ring-1 focus-visible:ring-ring/40",
                active
                  ? "border-primary/70 bg-primary/10 text-foreground"
                  : "border-border/60 bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                pending && "opacity-70",
              )}
            >
              <span className="truncate">{t(code)}</span>
              {active ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
