"use client"

import { ChangeEvent, useCallback, useEffect, useState } from "react"
import { useUnit } from "effector-react"
import { useTranslations } from "next-intl"

import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { EmptyState } from "@/shared/ui/page-toolbar"
import { AppearancePanel } from "@/features/theme/ui/ThemeSwitcher"
import { fetchCatalogFx } from "@/entities/device/model/store"
import { $user } from "@/entities/auth/model/store"
import { cn } from "@/shared/lib/utils"
import { stackItemOffsetClass, stackRadiusClass } from "@/shared/lib/stack-radius"

type SettingsTab = "account" | "appearance" | "users" | "backup" | "tools"

type User = {
  id: string
  email: string
  role?: string
  created_at?: string
}

type CurrentUser = {
  id?: string
  email?: string
}

type ApiList<T> = {
  items: T[]
}

type ApiOptions = {
  requestError?: (status: number) => string
}

async function api<T>(
  path: string,
  init?: RequestInit,
  options?: ApiOptions,
): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  })
  if (!response.ok) {
    const message =
      options?.requestError?.(response.status) ||
      (await response.text()) ||
      `HTTP ${response.status}`
    throw new Error(message)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

export function SettingsPage({ tab = "account" }: { tab?: SettingsTab }) {
  return (
    <div className="iotvex-page mx-auto w-full max-w-5xl space-y-5">
      <div className="min-w-0">
        {tab === "account" ? <AccountPanel /> : null}
        {tab === "appearance" ? <AppearanceSection /> : null}
        {tab === "users" ? <UsersPanel /> : null}
        {tab === "backup" ? <BackupPanel /> : null}
        {tab === "tools" ? <ToolsPanel /> : null}
      </div>
    </div>
  )
}

function AccountPanel() {
  const t = useTranslations("settings")
  const common = useTranslations("common")
  const tTop = useTranslations("topbar")
  const user = useUnit($user) as CurrentUser | null

  return (
    <section className="space-y-4">
      <Card className="iotvex-card-in overflow-hidden">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">{t("account.profileTitle")}</CardTitle>
          <CardDescription>{t("account.profileDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <InfoTile label={common("email")} value={user?.email ?? common("notSpecified")} />
          <InfoTile label={t("account.idLabel")} value={user?.id ?? common("unknown")} mono />
        </CardContent>
      </Card>
      <Button
        variant="secondary"
        className="w-full"
        onClick={async () => {
          try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
          } catch {
            /* ignore */
          }
          window.location.href = "/login"
        }}
      >
        {tTop("logout")}
      </Button>
    </section>
  )
}

function AppearanceSection() {
  return (
    <section className="space-y-4">
      <Card className="iotvex-card-in overflow-hidden">
        <CardContent className="pt-6">
          <AppearancePanel />
        </CardContent>
      </Card>
    </section>
  )
}

function UsersPanel() {
  const t = useTranslations("settings")
  const common = useTranslations("common")
  const [items, setItems] = useState<User[]>([])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestError = useCallback((status: number) => t("requestError", { status }), [t])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api<ApiList<User>>("/api/users", undefined, { requestError })
      setItems(data.items)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("users.loadError"))
    } finally {
      setLoading(false)
    }
  }, [requestError, t])

  useEffect(() => {
    void load()
  }, [load])

  const createUser = async () => {
    setSaving(true)
    setError(null)
    try {
      await api(
        "/api/users",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim(), password }),
        },
        { requestError },
      )
      setEmail("")
      setPassword("")
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("users.createError"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <Card className="iotvex-card-in overflow-hidden">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">{t("users.newTitle")}</CardTitle>
          <CardDescription>{t("users.newDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="new-user-email">{common("email")}</Label>
              <Input
                id="new-user-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("users.emailPlaceholder")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-user-password">{common("password")}</Label>
              <Input
                id="new-user-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>
          <div>
            <Button
              size="sm"
              onClick={() => void createUser()}
              disabled={saving || !email.trim() || password.length < 6}
            >
              {saving ? common("creating") : t("users.create")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && items.length === 0 ? (
        <EmptyState title={t("users.emptyTitle")} description={t("users.emptyDescription")} />
      ) : (
        <div className="flex flex-col">
          {items.map((user, index) => (
            <div
              key={user.id}
              className={cn(
                "iotvex-card-in flex items-center gap-3 border border-border/60 bg-card/60 px-3 py-3",
                stackRadiusClass(index, items.length, "xl"),
                stackItemOffsetClass(index),
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.email}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground" title={user.id}>
                  {user.id}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {user.role ?? t("users.defaultRole")}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function BackupPanel() {
  const t = useTranslations("settings")
  const [panelOrigin, setPanelOrigin] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requestError = useCallback((status: number) => t("requestError", { status }), [t])

  useEffect(() => {
    if (typeof window !== "undefined") setPanelOrigin(window.location.origin)
  }, [])

  const exportCatalog = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch("/api/catalog/export")
      if (!response.ok) {
        throw new Error((await response.text()) || t("backup.exportError"))
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `iotvex-catalog-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setMessage(t("backup.exportStarted"))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("backup.exportError"))
    } finally {
      setBusy(false)
    }
  }

  const importCatalog = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      await api(
        "/api/catalog/import",
        { method: "POST", body: JSON.stringify(payload) },
        { requestError },
      )
      setMessage(t("backup.imported"))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("backup.importError"))
    } finally {
      setBusy(false)
      event.target.value = ""
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="iotvex-card-in overflow-hidden">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">{t("backup.exportTitle")}</CardTitle>
            <CardDescription>{t("backup.exportDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" onClick={() => void exportCatalog()} disabled={busy}>
              {t("backup.downloadJson")}
            </Button>
          </CardContent>
        </Card>
        <Card className="iotvex-card-in overflow-hidden">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base">{t("backup.importTitle")}</CardTitle>
            <CardDescription>{t("backup.importDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void importCatalog(event)}
              disabled={busy}
            />
          </CardContent>
        </Card>
      </div>
      <Card className="iotvex-card-in overflow-hidden">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">{t("backup.localUrlTitle")}</CardTitle>
          <CardDescription>{t("backup.localUrlDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block truncate rounded-lg bg-muted px-3 py-2 text-xs sm:text-sm" title={panelOrigin}>
            {panelOrigin || "—"}
          </code>
        </CardContent>
      </Card>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  )
}

function ToolsPanel() {
  const t = useTranslations("settings")
  const common = useTranslations("common")
  const requestError = useCallback((status: number) => t("requestError", { status }), [t])
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runTool = async (name: string, action: () => Promise<string>) => {
    setBusyAction(name)
    setMessage(null)
    setError(null)
    try {
      setMessage(await action())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("tools.commandError"))
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ToolCard
          title={t("tools.discoverTitle")}
          description={t("tools.discoverDescription")}
          action={t("tools.discoverAction")}
          busyLabel={common("working")}
          busy={busyAction === "discover"}
          onClick={() =>
            void runTool("discover", async () => {
              await api("/api/devices/discover", { method: "POST" }, { requestError })
              fetchCatalogFx()
              return t("tools.discoverStarted")
            })
          }
        />
        <ToolCard
          title={t("tools.catalogTitle")}
          description={t("tools.catalogDescription")}
          action={t("tools.catalogTitle")}
          busyLabel={common("working")}
          busy={busyAction === "refresh"}
          onClick={() =>
            void runTool("refresh", async () => {
              await api("/api/home", undefined, { requestError })
              fetchCatalogFx()
              return t("tools.catalogRefreshed")
            })
          }
        />
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  )
}

function ToolCard({
  title,
  description,
  action,
  busyLabel,
  busy,
  onClick,
}: {
  title: string
  description: string
  action: string
  busyLabel: string
  busy: boolean
  onClick: () => void
}) {
  return (
    <Card className="iotvex-card-in overflow-hidden">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="line-clamp-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="sm" onClick={onClick} disabled={busy}>
          {busy ? busyLabel : action}
        </Button>
      </CardContent>
    </Card>
  )
}

function InfoTile({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-background/50 px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 truncate text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}
