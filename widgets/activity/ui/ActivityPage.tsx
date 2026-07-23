"use client"

import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { EmptyState, FilterChips, PageToolbar } from "@/shared/ui/page-toolbar"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover"
import { cn } from "@/shared/lib/utils"
import { Check, RefreshCw, SlidersHorizontal, Trash2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"

type EventRow = {
  id: string
  kind: string
  title: string
  detail: string
  entity_id: string | null
  created_at: string
}

type SortId = "newest" | "oldest" | "titleAsc" | "titleDesc" | "kindAsc"

export function ActivityPage() {
  const t = useTranslations("activity")
  const locale = useLocale()
  const [items, setItems] = useState<EventRow[]>([])
  const [q, setQ] = useState("")
  const [kind, setKind] = useState("all")
  const [sort, setSort] = useState<SortId>("newest")
  const [pending, start] = useTransition()

  const load = useCallback(async () => {
    const res = await fetch("/api/events?limit=200", { cache: "no-store" })
    const data = await res.json()
    setItems(data.items || [])
  }, [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => void load(), 12000)
    return () => clearInterval(timer)
  }, [load])

  const kinds = useMemo(() => {
    const set = new Set(items.map((i) => i.kind).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [items])

  const sortOptions = useMemo(
    () =>
      [
        { id: "newest" as const, label: t("sortNewest") },
        { id: "oldest" as const, label: t("sortOldest") },
        { id: "titleAsc" as const, label: t("sortTitleAsc") },
        { id: "titleDesc" as const, label: t("sortTitleDesc") },
        { id: "kindAsc" as const, label: t("sortKindAsc") },
      ] as const,
    [t],
  )

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase()
    let list = items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false
      if (!query) return true
      return (
        item.title.toLowerCase().includes(query) ||
        item.kind.toLowerCase().includes(query) ||
        (item.detail || "").toLowerCase().includes(query) ||
        (item.entity_id || "").toLowerCase().includes(query)
      )
    })

    const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true })
    list = [...list].sort((a, b) => {
      if (sort === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sort === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      if (sort === "titleAsc") return collator.compare(a.title, b.title)
      if (sort === "titleDesc") return collator.compare(b.title, a.title)
      return collator.compare(a.kind, b.kind)
    })
    return list
  }, [items, kind, locale, q, sort])

  const filtersActive = kind !== "all" || sort !== "newest"

  return (
    <div className="iotvex-page space-y-4">
      <PageToolbar
        actions={
          <div className="flex w-full min-w-0 items-center gap-1.5">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-10 min-w-0 flex-1"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className={cn(
                    "h-10 w-10 shrink-0",
                    filtersActive && "border border-primary/35 text-primary",
                  )}
                  aria-label={t("filterAria")}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] space-y-3.5 p-3">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t("filterKindLabel")}
                  </div>
                  <FilterChips
                    value={kind}
                    onChange={setKind}
                    items={[
                      { id: "all", label: t("filterAll") },
                      ...kinds.map((k) => ({ id: k, label: k })),
                    ]}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t("sortLabel")}
                  </div>
                  <div className="grid gap-0.5">
                    {sortOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSort(option.id)}
                        className={cn(
                          "flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-left text-sm transition-colors",
                          sort === option.id
                            ? "bg-white/[0.06] text-foreground"
                            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                        )}
                      >
                        <span>{option.label}</span>
                        {sort === option.id ? <Check className="h-4 w-4 text-primary" /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-10 w-10 shrink-0"
              disabled={pending}
              aria-label={t("refresh")}
              onClick={() => start(() => void load())}
            >
              <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-10 w-10 shrink-0"
              disabled={pending || !items.length}
              aria-label={t("clearJournal")}
              onClick={() =>
                start(async () => {
                  await fetch("/api/events", { method: "DELETE" })
                  await load()
                })
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/55 backdrop-blur-xl dark:border-white/[0.08] dark:bg-card/40">
        {visible.length === 0 ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <ul className="divide-y divide-border/50">
            {visible.map((e, i) => (
              <li
                key={e.id}
                className="iotvex-row-in flex min-w-0 flex-col gap-1 overflow-hidden px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between"
                style={{ animationDelay: `${Math.min(i, 24) * 16}ms` }}
              >
                <div className="min-w-0 overflow-hidden">
                  <p className="break-words text-sm font-medium">{e.title}</p>
                  <p className="iotvex-hide-scroll mt-0.5 min-w-0 overflow-x-auto whitespace-nowrap text-xs text-muted-foreground">
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
