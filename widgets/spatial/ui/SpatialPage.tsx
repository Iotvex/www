"use client"

import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"

const PlanaHost = dynamic(() => import("./PlanaHost"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(70dvh,36rem)] items-center justify-center text-sm text-muted-foreground">
      …
    </div>
  ),
})

/**
 * Floor-plan host — plana engine (local package), adaptive chrome.
 */
export function SpatialPage() {
  const t = useTranslations("views.spatial")
  return (
    <div className="flex min-h-[min(70dvh,36rem)] flex-col gap-2 sm:gap-3 md:h-[calc(100dvh-8.5rem)] md:min-h-[28rem]">
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      <div className="relative min-h-[min(62dvh,32rem)] flex-1 overflow-hidden rounded-xl border border-border bg-background md:min-h-0">
        <PlanaHost />
      </div>
    </div>
  )
}
