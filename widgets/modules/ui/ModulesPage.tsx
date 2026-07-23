"use client"

import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { ExternalLink, Plus, Trash2, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState, useTransition } from "react"
import { cn } from "@/shared/lib/utils"
import { EmptyState, CreateCard, PageToolbar } from "@/shared/ui/page-toolbar"

type Mod = {
  id: string
  name: string
  description: string
  source_url: string | null
  enabled: boolean
  manifest: Record<string, unknown>
}

export function ModulesPage() {
  const t = useTranslations("modules")
  const tCommon = useTranslations("common")
  const [items, setItems] = useState<Mod[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [id, setId] = useState("")
  const [url, setUrl] = useState("")
  const [pending, start] = useTransition()

  const load = useCallback(async () => {
    const res = await fetch("/api/modules", { cache: "no-store" })
    const data = await res.json()
    setItems(data.items || [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const create = () => {
    start(async () => {
      await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id.trim() || undefined,
          name: name.trim(),
          source_url: url.trim() || null,
        }),
      })
      setOpen(false)
      setName("")
      setId("")
      setUrl("")
      await load()
    })
  }

  const toggle = (m: Mod) => {
    start(async () => {
      await fetch("/api/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, enabled: !m.enabled }),
      })
      await load()
    })
  }

  const remove = (modId: string) => {
    start(async () => {
      await fetch(`/api/modules?id=${encodeURIComponent(modId)}`, { method: "DELETE" })
      await load()
    })
  }

  return (
    <div className="iotvex-page space-y-4">
      <PageToolbar
        actions={
          items.length > 0 ? (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => void load()}>
              <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
              {t("refresh")}
            </Button>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("connect")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((m, i) => (
            <article
              key={m.id}
              className="iotvex-card-in rounded-xl border border-border/60 bg-card/55 p-4 backdrop-blur-xl transition-colors duration-300 hover:bg-card/70 dark:border-white/[0.08] dark:bg-card/40"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold tracking-tight">{m.name}</h2>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    m.enabled
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {m.enabled ? t("enabledShort") : t("disabledShort")}
                </span>
              </div>
              {m.description ? (
                <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>
              ) : null}
              {m.source_url ? (
                <a
                  href={m.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {m.source_url}
                </a>
              ) : null}
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggle(m)}>
                  {m.enabled ? t("disable") : t("enable")}
                </Button>
                <Button size="sm" variant="ghost" aria-label={tCommon("delete")} onClick={() => remove(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {items.length > 0 ? (
        <CreateCard label={t("connect")} onClick={() => setOpen(true)} />
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">{t("nameLabel")}</Label>
              <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-id">{t("idOptionalLabel")}</Label>
              <Input
                id="m-id"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder={t("idPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-url">{t("manifestUrlLabel")}</Label>
              <Input
                id="m-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t("manifestUrlPlaceholder")}
              />
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || pending}
              onClick={create}
            >
              {t("register")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
