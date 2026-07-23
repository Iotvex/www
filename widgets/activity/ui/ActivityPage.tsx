"use client"

import { Button } from "@/shared/ui/button"
import { EmptyState, FilterChips, PageToolbar } from "@/shared/ui/page-toolbar"
import { RefreshCw, Trash2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { cn } from "@/shared/lib/utils"

type EventRow = {
  id: string
  kind: string
  title: string
  detail: string
  entity_id: string | null
  created_at: string
}

export function ActivityPage() {
  const t = useTranslations("activity")
  const locale = useLocale()
  const [items, setItems] = useState<EventRow[]>([])
  const [kind, setKind] = useState("all")
  const [pending, start] = useTransition()

  const load = useCallback(async () => {
    const url = kind === "all" ? "/api/events?limit=200" : `/api/events?limit=200&kind=${encodeURIComponent(kind)}`
    const res = await fetch(url, { cache: "no-store" })
    const data = await res.json()
    setItems(data.items || [])
  }, [kind])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 12000)
    return () => clearInterval(timer)
  }, [load])

  const kinds = useMemo(() => {
    const set = new Set(items.map((i) => i.kind))
    return Array.from(set).sort()
  }, [items])

  return (
    <div className="iotvex-page space-y-4">
      <PageToolbar
        meta={items.length ? t("metaCount", { count: items.length }) : t("metaEmpty")}
        actions={
          <>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => start(() => void load())}>
              <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
              {t("refresh")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending || !items.length}
              onClick={() =>
                start(async () => {
                  await fetch("/api/events", { method: "DELETE" })
                  await load()
                })
              }
            >
              <Trash2 className="h-4 w-4" />
              {t("clearJournal")}
            </Button>
          </>
        }
      />

      <div className="iotvex-glass-muted rounded-2xl p-2">
        <FilterChips
          value={kind}
          onChange={setKind}
          items={[
            { id: "all", label: t("filterAll") },
            ...kinds.map((k) => ({ id: k, label: k })),
          ]}
        />
      </div>

      <div className="iotvex-glass overflow-hidden rounded-2xl">
        {items.length === 0 ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <ul className="divide-y divide-border/50">
            {items.map((e, i) => (
              <li
                key={e.id}
                className="iotvex-row-in flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between"
                style={{ animationDelay: `${Math.min(i, 24) * 16}ms` }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.kind}
                    {e.detail ? ` · ${e.detail}` : ""}
                    {e.entity_id ? ` · ${e.entity_id}` : ""}
                  </p>
                </div>
                <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {new Date(e.created_at).toLocaleString(locale)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
