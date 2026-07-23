"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { Switch } from "@/shared/ui/switch"
import { StatusDot } from "@/shared/ui/page-toolbar"

type WwwMode = "local" | "local_published" | "cloud"
type DbMode = "local" | "cloud_public" | "cloud_private"

type RuntimePayload = {
  ok?: boolean
  runtime?: {
    wwwMode?: WwwMode
    dbMode?: DbMode
    mdnsName?: string
    timezone?: string
    agentUrl?: string
    agentIsLocal?: boolean
    supabaseUrlHost?: string
    supabaseBrowserUrl?: string
    httpPort?: number
    httpsPort?: number
    access?: {
      lanHttp?: string
      lanHttps?: string
      mdnsHttp?: string
      mdnsHttps?: string
      customDomain?: string | null
      published?: boolean
    }
    publish?: {
      customDomain?: string
      providers?: Record<
        string,
        {
          enabled?: boolean
          subdomain?: string
          region?: string
          hostname?: string
          domain?: string
        }
      >
    }
    cloudWww?: { baseUrl?: string }
    dbTargets?: Record<string, { configured?: boolean }>
    matrix?: {
      needsWwwPublish?: boolean
      needsLocalDbBridge?: boolean
      needsAgentBridge?: boolean
      summary?: string
    }
    bridge?: {
      wwwPublicUrl?: string
      localDbPublicUrl?: string
      agentPublicUrl?: string
      autoFromMatrix?: boolean
      preferredProvider?: string
    }
    supabasePublicUrl?: string | null
    agentPublicUrl?: string | null
  }
  agent?: { ok?: boolean }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      (data && (data.error || data.message)) || `HTTP ${res.status}`,
    )
  }
  return data as T
}

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

const WWW_MODES: WwwMode[] = ["local", "local_published", "cloud"]
const DB_MODES: DbMode[] = ["local", "cloud_public", "cloud_private"]

const PROVIDER_FIELDS: Record<
  string,
  { label: string; fields: Array<"subdomain" | "region" | "hostname" | "domain" | "authtoken" | "tunnelToken"> }
> = {
  caddy_local: { label: "Caddy (:8443)", fields: [] },
  pinggy: { label: "Pinggy", fields: ["authtoken", "subdomain", "region"] },
  cloudflare_tunnel: {
    label: "Cloudflare Tunnel",
    fields: ["tunnelToken", "hostname"],
  },
  ngrok: { label: "ngrok", fields: ["authtoken", "domain"] },
  tailscale_funnel: { label: "Tailscale Funnel", fields: ["hostname"] },
}

export function DeploymentPanel() {
  const t = useTranslations("settings.deployment")
  const common = useTranslations("common")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [payload, setPayload] = useState<RuntimePayload | null>(null)

  const [wwwMode, setWwwMode] = useState<WwwMode>("local")
  const [mdnsName, setMdnsName] = useState("iotvex.local")
  const [customDomain, setCustomDomain] = useState("")
  const [cloudWwwUrl, setCloudWwwUrl] = useState("")
  const [providers, setProviders] = useState<
    Record<string, Record<string, string | boolean>>
  >({})

  const [dbMode, setDbMode] = useState<DbMode>("local")
  const [targetUrl, setTargetUrl] = useState("")
  const [targetAnon, setTargetAnon] = useState("")
  const [targetService, setTargetService] = useState("")
  const [merge, setMerge] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [publishNote, setPublishNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api<RuntimePayload>("/api/runtime")
      setPayload(data)
      const rt = data.runtime
      if (rt?.wwwMode) setWwwMode(rt.wwwMode)
      if (rt?.mdnsName) setMdnsName(rt.mdnsName)
      if (rt?.publish?.customDomain != null) setCustomDomain(rt.publish.customDomain)
      if (rt?.cloudWww?.baseUrl != null) setCloudWwwUrl(rt.cloudWww.baseUrl)
      if (rt?.dbMode) setDbMode(rt.dbMode)
      const nextProviders: Record<string, Record<string, string | boolean>> = {}
      for (const [id, meta] of Object.entries(PROVIDER_FIELDS)) {
        const cur = rt?.publish?.providers?.[id] || {}
        nextProviders[id] = {
          enabled: Boolean(cur.enabled),
          subdomain: cur.subdomain || "",
          region: cur.region || "",
          hostname: cur.hostname || "",
          domain: cur.domain || "",
          authtoken: "",
          tunnelToken: "",
        }
        void meta
      }
      setProviders(nextProviders)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const accessLines = useMemo(() => {
    const a = payload?.runtime?.access
    if (!a) return []
    const lines = [
      { label: "HTTP LAN", value: a.lanHttp },
      { label: "HTTPS LAN", value: a.lanHttps },
      { label: "HTTP mDNS", value: a.mdnsHttp },
      { label: "HTTPS mDNS", value: a.mdnsHttps },
    ]
    if (a.customDomain) lines.push({ label: "Domain", value: a.customDomain })
    return lines
  }, [payload])

  const refreshPublish = async () => {
    try {
      const data = await api<any>("/api/runtime/publish")
      setPublishNote(
        t("publishStatus", {
          tunnels: Object.keys(data.state?.tunnels || {}).join(", ") || "none",
        }),
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t("publishError"))
    }
  }

  const applyPublish = async (action: "reconcile" | "stop-all") => {
    setPublishing(true)
    setError(null)
    setPublishNote(null)
    try {
      // Persist current www/db selection first so host manager sees it
      await api("/api/runtime", {
        method: "PATCH",
        body: JSON.stringify({
          wwwMode,
          mdnsName,
          bridge: {
            autoFromMatrix: true,
            preferredProvider:
              Object.entries(providers).find(([, v]) => v.enabled)?.[0] ||
              "cloudflare_tunnel",
          },
        }),
      })
      const res = await api<any>("/api/runtime/publish", {
        method: "POST",
        body: JSON.stringify({ action }),
      })
      setPublishNote(res.note || t("publishQueued"))
      // Host path unit usually fires within seconds
      window.setTimeout(() => void refreshPublish(), 2500)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t("publishError"))
    } finally {
      setPublishing(false)
    }
  }

  const saveWww = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const publishProviders: Record<string, Record<string, unknown>> = {}
      const secretPublish: Record<string, Record<string, string>> = {}
      for (const [id, vals] of Object.entries(providers)) {
        publishProviders[id] = {
          enabled: Boolean(vals.enabled),
          subdomain: String(vals.subdomain || ""),
          region: String(vals.region || ""),
          hostname: String(vals.hostname || ""),
          domain: String(vals.domain || ""),
        }
        if (vals.authtoken) {
          secretPublish[id] = {
            ...(secretPublish[id] || {}),
            authtoken: String(vals.authtoken),
          }
        }
        if (vals.tunnelToken) {
          secretPublish[id] = {
            ...(secretPublish[id] || {}),
            tunnelToken: String(vals.tunnelToken),
          }
        }
      }
      await api("/api/runtime", {
        method: "PATCH",
        body: JSON.stringify({
          wwwMode,
          mdnsName,
          publish: {
            customDomain,
            providers: publishProviders,
          },
          cloudWww: { baseUrl: cloudWwwUrl },
          secrets: Object.keys(secretPublish).length
            ? { publish: secretPublish }
            : undefined,
        }),
      })
      setMessage(t("saved"))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveError"))
    } finally {
      setSaving(false)
    }
  }

  const switchDb = async () => {
    setSwitching(true)
    setError(null)
    setMessage(null)
    try {
      const body: Record<string, unknown> = {
        mode: dbMode,
        merge,
      }
      if (dbMode !== "local") {
        body.url = targetUrl.trim()
        body.anonKey = targetAnon.trim()
        body.serviceRoleKey = targetService.trim()
      } else if (targetService.trim()) {
        body.serviceRoleKey = targetService.trim()
        if (targetUrl.trim()) body.url = targetUrl.trim()
      }
      const res = await api<{ ok?: boolean; merge?: { imported?: number }; error?: string }>(
        "/api/runtime/db/switch",
        { method: "POST", body: JSON.stringify(body) },
      )
      setMessage(
        t("switched", {
          imported: res.merge?.imported ?? 0,
        }),
      )
      // Hot reload browser inject + clients
      window.setTimeout(() => window.location.reload(), 600)
    } catch (e) {
      setError(e instanceof Error ? e.message : t("switchError"))
    } finally {
      setSwitching(false)
    }
  }

  const probeDb = async () => {
    setError(null)
    setMessage(null)
    try {
      const res = await api<{ ok?: boolean; checks?: unknown }>(
        "/api/runtime/db/probe",
        {
          method: "POST",
          body: JSON.stringify({
            mode: dbMode,
            url: targetUrl.trim(),
            anonKey: targetAnon.trim(),
            serviceRoleKey: targetService.trim(),
          }),
        },
      )
      setMessage(res.ok ? t("probeOk") : t("probeFail"))
    } catch (e) {
      setError(e instanceof Error ? e.message : t("probeFail"))
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{common("loading")}</p>
  }

  return (
    <section className="space-y-5">
      <SectionIntro title={t("title")} description={t("description")} />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}

      <Card className="iotvex-card-in overflow-hidden">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">{t("wwwTitle")}</CardTitle>
            <Badge variant="secondary">{wwwMode}</Badge>
          </div>
          <CardDescription>{t("wwwDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>{t("wwwModeLabel")}</Label>
            <div className="flex flex-wrap gap-2">
              {WWW_MODES.map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={wwwMode === mode ? "default" : "outline"}
                  onClick={() => setWwwMode(mode)}
                >
                  {t(`wwwModes.${mode}`)}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t(`wwwModeHelp.${wwwMode}`)}</p>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="mdns">{t("mdnsLabel")}</Label>
              <Input
                id="mdns"
                value={mdnsName}
                onChange={(e) => setMdnsName(e.target.value)}
                placeholder="iotvex.local"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="domain">{t("customDomainLabel")}</Label>
              <Input
                id="domain"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="home.example.com"
                disabled={wwwMode === "local"}
              />
            </div>
          </div>

          {wwwMode === "cloud" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="cloud-www">{t("cloudWwwLabel")}</Label>
              <Input
                id="cloud-www"
                value={cloudWwwUrl}
                onChange={(e) => setCloudWwwUrl(e.target.value)}
                placeholder="https://app.iotvex.com"
              />
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label>{t("accessLabel")}</Label>
            <div className="grid gap-1.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
              {accessLines.map((line) => (
                <div key={line.label} className="flex flex-wrap justify-between gap-2">
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className="font-mono">{line.value}</span>
                </div>
              ))}
              <p className="pt-1 text-muted-foreground">{t("accessHint")}</p>
            </div>
          </div>

          {(wwwMode === "local_published" || wwwMode === "cloud") && (
            <div className="grid gap-3">
              <Label>{t("providersLabel")}</Label>
              {Object.entries(PROVIDER_FIELDS).map(([id, meta]) => {
                const vals = providers[id] || { enabled: false }
                return (
                  <div
                    key={id}
                    className="rounded-xl border border-border/60 bg-card/50 p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{meta.label}</p>
                        <p className="text-xs text-muted-foreground">{id}</p>
                      </div>
                      <Switch
                        checked={Boolean(vals.enabled)}
                        onCheckedChange={(checked) =>
                          setProviders((prev) => ({
                            ...prev,
                            [id]: { ...prev[id], enabled: checked },
                          }))
                        }
                      />
                    </div>
                    {Boolean(vals.enabled) && meta.fields.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {meta.fields.map((field) => (
                          <div key={field} className="grid gap-1">
                            <Label className="text-xs">{field}</Label>
                            <Input
                              type={
                                field === "authtoken" || field === "tunnelToken"
                                  ? "password"
                                  : "text"
                              }
                              value={String(vals[field] || "")}
                              onChange={(e) =>
                                setProviders((prev) => ({
                                  ...prev,
                                  [id]: { ...prev[id], [field]: e.target.value },
                                }))
                              }
                              placeholder={
                                field === "authtoken" || field === "tunnelToken"
                                  ? "••••••••"
                                  : undefined
                              }
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}

          <div>
            <Button size="sm" onClick={() => void saveWww()} disabled={saving}>
              {saving ? common("saving") : t("saveWww")}
            </Button>
          </div>
        </CardContent>
      </Card>


      <Card className="iotvex-card-in overflow-hidden">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">{t("matrixTitle")}</CardTitle>
          <CardDescription>{t("matrixDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            {payload?.runtime?.matrix?.summary || t("matrixCurrent", { www: wwwMode, db: dbMode })}
          </p>
          <div className="grid gap-1 text-[11px] font-mono leading-relaxed text-muted-foreground">
            <div>needsWwwPublish: {String(payload?.runtime?.matrix?.needsWwwPublish)}</div>
            <div>needsLocalDbBridge: {String(payload?.runtime?.matrix?.needsLocalDbBridge)}</div>
            <div>needsAgentBridge: {String(payload?.runtime?.matrix?.needsAgentBridge)}</div>
            <div>supabasePublicUrl: {payload?.runtime?.supabasePublicUrl || "—"}</div>
            <div>agentPublicUrl: {payload?.runtime?.agentPublicUrl || "—"}</div>
            <div>wwwPublicUrl: {payload?.runtime?.bridge?.wwwPublicUrl || "—"}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void applyPublish("reconcile")} disabled={publishing}>
              {publishing ? t("publishing") : t("applyPublish")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void applyPublish("stop-all")} disabled={publishing}>
              {t("stopPublish")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void refreshPublish()} disabled={publishing}>
              {t("refreshPublish")}
            </Button>
          </div>
          {publishNote ? <p className="text-xs text-muted-foreground">{publishNote}</p> : null}
        </CardContent>
      </Card>

      <Card className="iotvex-card-in overflow-hidden">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">{t("dbTitle")}</CardTitle>
            <Badge variant="secondary">{payload?.runtime?.dbMode}</Badge>
          </div>
          <CardDescription>{t("dbDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <StatusDot
              tone={payload?.agent?.ok ? "good" : "bad"}
            />
            <span>
              {t("activeDb")}: {payload?.runtime?.supabaseUrlHost}
            </span>
          </div>

          <div className="grid gap-2">
            <Label>{t("dbModeLabel")}</Label>
            <div className="flex flex-wrap gap-2">
              {DB_MODES.map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={dbMode === mode ? "default" : "outline"}
                  onClick={() => setDbMode(mode)}
                >
                  {t(`dbModes.${mode}`)}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t(`dbModeHelp.${dbMode}`)}</p>
          </div>

          <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>{t("targetUrl")}</Label>
                <Input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder={
                    dbMode === "local"
                      ? "http://host.docker.internal:54321"
                      : "https://xxxx.supabase.co"
                  }
                />
              </div>
              {dbMode !== "local" ? (
                <div className="grid gap-1.5">
                  <Label>{t("targetAnon")}</Label>
                  <Input
                    value={targetAnon}
                    onChange={(e) => setTargetAnon(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label>{t("targetService")}</Label>
                <Input
                  type="password"
                  value={targetService}
                  onChange={(e) => setTargetService(e.target.value)}
                  placeholder={dbMode === "local" ? t("optionalIfLocal") : undefined}
                />
              </div>
            </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2">
            <div>
              <p className="text-sm font-medium">{t("mergeLabel")}</p>
              <p className="text-xs text-muted-foreground">{t("mergeHelp")}</p>
            </div>
            <Switch checked={merge} onCheckedChange={setMerge} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void probeDb()}
              disabled={switching || (dbMode !== "local" && (!targetUrl || !targetService))}
            >
              {t("probe")}
            </Button>
            <Button
              size="sm"
              onClick={() => void switchDb()}
              disabled={
                switching ||
                (dbMode !== "local" && (!targetUrl.trim() || !targetService.trim()))
              }
            >
              {switching ? t("switching") : t("switch")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
