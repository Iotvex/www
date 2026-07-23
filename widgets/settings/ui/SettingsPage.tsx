"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useUnit } from "effector-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  EmptyState,
  StatusDot,
} from "@/shared/ui/page-toolbar";
import { AppearancePanel } from "@/features/theme/ui/ThemeSwitcher";
import { $agentConnection, $agentOnline, $node, $nodeError, fetchCatalogFx } from "@/entities/device/model/store";
import { $user } from "@/entities/auth/model/store";
import { DeploymentPanel } from "@/widgets/settings/ui/DeploymentPanel";

type SettingsTab = "account" | "appearance" | "services" | "users" | "backup" | "tools";

type User = {
  id: string;
  email: string;
  role?: string;
  created_at?: string;
};

type CurrentUser = {
  id?: string;
  email?: string;
};

type NodeStatus = {
  id?: string;
  name?: string;
  online?: boolean;
  status?: string;
  version?: string;
};

type PublicUrlResponse = {
  url?: string;
  public_url?: string;
};

type ApiList<T> = {
  items: T[];
};

type ApiOptions = {
  requestError?: (status: number) => string;
};

type RuntimeResponse = {
  ok?: boolean;
  runtime?: {
    devicePlane?: string;
    wwwMode?: string;
    dbMode?: string;
    agentUrl?: string;
    agentIsLocal?: boolean;
    supabaseUrlHost?: string;
    timezone?: string;
    automationsScheduler?: string;
    mdnsName?: string;
  };
  agent?: { ok?: boolean; status?: number; error?: string };
  notes?: Record<string, string>;
};

async function api<T>(url: string, init?: RequestInit, options?: ApiOptions): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || options?.requestError?.(response.status) || `Request error ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

export function SettingsPage({ tab = "account" }: { tab?: SettingsTab }) {
  return (
    <div className="iotvex-page mx-auto w-full max-w-3xl space-y-5">
      <div className="min-w-0">
        {tab === "account" ? <AccountPanel /> : null}
        {tab === "appearance" ? <AppearanceSection /> : null}
        {tab === "services" ? <DeploymentPanel /> : null}
        {tab === "users" ? <UsersPanel /> : null}
        {tab === "backup" ? <BackupPanel /> : null}
        {tab === "tools" ? <ToolsPanel /> : null}
      </div>
    </div>
  );
}

function AccountPanel() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const user = useUnit($user) as CurrentUser | null;

  return (
    <section className="space-y-4">
      <SectionIntro title={t("account.title")} description={t("account.description")} />
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
    </section>
  );
}

function AppearanceSection() {
  const t = useTranslations("settings");

  return (
    <section className="space-y-4">
      <SectionIntro title={t("appearance.title")} description={t("appearance.description")} />
      <Card className="iotvex-card-in overflow-hidden">
        <CardContent className="pt-6">
          <AppearancePanel />
        </CardContent>
      </Card>
    </section>
  );
}

function ServicesPanel() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const node = useUnit($node) as NodeStatus | null;
  const nodeError = useUnit($nodeError) as string | Error | null;
  const agentOnline = useUnit($agentOnline);
  const agentConnection = useUnit($agentConnection);
  const [runtime, setRuntime] = useState<RuntimeResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<RuntimeResponse>("/api/runtime");
        if (!cancelled) setRuntime(data);
      } catch {
        if (!cancelled) setRuntime(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rt = runtime?.runtime;
  const wwwMode = rt?.wwwMode ?? "lan";
  const dbMode = rt?.dbMode ?? "local";

  const services = useMemo(
    () => [
      {
        title: t("services.agentTitle"),
        description: node?.name ?? node?.id ?? t("services.localAgent"),
        status:
          agentConnection === "pending"
            ? t("services.checkingStatus")
            : agentOnline
              ? common("online")
              : t("services.errorStatus"),
        tone: agentConnection === "pending" ? "neutral" : agentOnline ? "good" : "bad",
        detail: [
          t("services.alwaysLocal"),
          rt?.agentUrl ? `URL: ${rt.agentUrl}` : null,
          nodeError
            ? nodeError instanceof Error
              ? nodeError.message
              : nodeError
            : node?.version ?? node?.status ?? t("services.ready"),
        ]
          .filter(Boolean)
          .join(" · "),
      },
      {
        title: t("services.otbrTitle"),
        description: t("services.otbrDescription"),
        status: t("services.localStatus"),
        tone: "good" as const,
        detail: `${t("services.alwaysLocal")} · ${t("services.otbrDetail")}`,
      },
      {
        title: t("services.databaseTitle"),
        description:
          dbMode === "remote"
            ? t("services.databaseRemoteDescription")
            : t("services.databaseDescription"),
        status: dbMode === "remote" ? t("services.remoteStatus") : t("services.localStatus"),
        tone: "good" as const,
        detail:
          dbMode === "remote"
            ? `${t("services.databaseRemoteDetail")} · ${rt?.supabaseUrlHost ?? ""}`
            : t("services.databaseDetail"),
      },
      {
        title: t("services.wwwTitle"),
        description:
          wwwMode === "published"
            ? t("services.wwwPublishedDescription")
            : t("services.wwwLanDescription"),
        status: wwwMode === "published" ? t("services.publishedStatus") : t("services.lanStatus"),
        tone: "neutral" as const,
        detail:
          wwwMode === "published"
            ? t("services.wwwPublishedDetail")
            : `${t("services.wwwLanDetail")} · ${rt?.mdnsName ?? "iotvex.local"}`,
      },
      {
        title: t("services.automationsTitle"),
        description: t("services.automationsDescription"),
        status: t("services.homeSchedulerStatus"),
        tone: "good" as const,
        detail: `${t("services.automationsDetail")} · TZ ${rt?.timezone ?? "—"}`,
      },
    ],
    [agentConnection, agentOnline, common, dbMode, node, nodeError, rt, t, wwwMode],
  );

  return (
    <section className="space-y-4">
      <SectionIntro title={t("services.title")} description={t("services.description")} />
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((service) => (
          <Card key={service.title} className="iotvex-card-in overflow-hidden">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="truncate text-base">{service.title}</CardTitle>
                <Badge
                  variant={service.tone === "bad" ? "danger" : "secondary"}
                  className="shrink-0"
                >
                  <span className="mr-1.5 inline-flex">
                    <StatusDot tone={service.tone as "good" | "bad" | "neutral"} />
                  </span>
                  {service.status}
                </Badge>
              </div>
              <CardDescription className="line-clamp-2">{service.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              {service.detail}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}


function UsersPanel() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const [items, setItems] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestError = useCallback((status: number) => t("requestError", { status }), [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ApiList<User>>("/api/users", undefined, { requestError });
      setItems(data.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("users.loadError"));
    } finally {
      setLoading(false);
    }
  }, [requestError, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const createUser = async () => {
    setSaving(true);
    setError(null);
    try {
      await api(
        "/api/users",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim(), password }),
        },
        { requestError },
      );
      setEmail("");
      setPassword("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("users.createError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <SectionIntro title={t("users.title")} description={t("users.description")} />

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

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          title={t("users.emptyTitle")}
          description={t("users.emptyDescription")}
        />
      ) : (
        <div className="grid gap-2">
          {items.map((user) => (
            <div
              key={user.id}
              className="iotvex-card-in flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-3"
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
  );
}

function BackupPanel() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const [publicUrl, setPublicUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestError = useCallback((status: number) => t("requestError", { status }), [t]);

  const loadPublicUrl = useCallback(async () => {
    setError(null);
    // Always prefer the origin the user actually opened (any LAN/WAN IP:port).
    if (typeof window !== "undefined" && window.location?.origin) {
      setPublicUrl(window.location.origin);
    }
    try {
      const data = await api<PublicUrlResponse>("/api/public-url", undefined, { requestError });
      setPublicUrl(data.public_url ?? data.url ?? window.location.origin);
    } catch (cause) {
      if (!window.location?.origin) {
        setError(cause instanceof Error ? cause.message : t("backup.loadPublicUrlError"));
      }
    }
  }, [requestError, t]);

  useEffect(() => {
    void loadPublicUrl();
  }, [loadPublicUrl]);

  const exportCatalog = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/catalog/export");
      if (!response.ok) {
        throw new Error((await response.text()) || t("backup.exportError"));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `iotvex-catalog-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage(t("backup.exportStarted"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("backup.exportError"));
    } finally {
      setBusy(false);
    }
  };

  const importCatalog = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await api(
        "/api/catalog/import",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        { requestError },
      );
      setMessage(t("backup.imported"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("backup.importError"));
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  return (
    <section className="space-y-4">
      <SectionIntro title={t("backup.title")} description={t("backup.description")} />

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
          <CardTitle className="text-base">{t("backup.publicUrlTitle")}</CardTitle>
          <CardDescription>{t("backup.publicUrlDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs sm:text-sm" title={publicUrl || undefined}>
            {publicUrl || t("backup.urlNotConfigured")}
          </code>
          <Button size="sm" variant="secondary" className="shrink-0" onClick={() => void loadPublicUrl()}>
            {common("refresh")}
          </Button>
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}

function ToolsPanel() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const requestError = useCallback((status: number) => t("requestError", { status }), [t]);
  const [publicUrl, setPublicUrl] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTool = async (name: string, action: () => Promise<string>) => {
    setBusyAction(name);
    setMessage(null);
    setError(null);
    try {
      setMessage(await action());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("tools.commandError"));
    } finally {
      setBusyAction(null);
    }
  };

  const discover = () =>
    runTool("discover", async () => {
      await api("/api/devices/discover", { method: "POST" }, { requestError });
      fetchCatalogFx();
      return t("tools.discoverStarted");
    });

  const refreshCatalog = () =>
    runTool("refresh", async () => {
      await api("/api/home", undefined, { requestError });
      fetchCatalogFx();
      return t("tools.catalogRefreshed");
    });

  const fetchPublicUrl = () =>
    runTool("public-url", async () => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      try {
        const data = await api<PublicUrlResponse>("/api/public-url", undefined, { requestError });
        const url = data.public_url ?? data.url ?? origin;
        setPublicUrl(url);
        return url ? t("tools.publicUrlReceived") : t("tools.publicUrlNotConfigured");
      } catch {
        setPublicUrl(origin);
        return origin ? t("tools.publicUrlReceived") : t("tools.publicUrlNotConfigured");
      }
    });

  return (
    <section className="space-y-4">
      <SectionIntro title={t("tools.title")} description={t("tools.description")} />

      <div className="grid gap-3 sm:grid-cols-3">
        <ToolCard
          title={t("tools.discoverTitle")}
          description={t("tools.discoverDescription")}
          action={t("tools.discoverAction")}
          busyLabel={t("tools.busy")}
          busy={busyAction === "discover"}
          onClick={() => void discover()}
        />
        <ToolCard
          title={t("tools.catalogTitle")}
          description={t("tools.catalogDescription")}
          action={common("refresh")}
          busyLabel={t("tools.busy")}
          busy={busyAction === "refresh"}
          onClick={() => void refreshCatalog()}
        />
        <ToolCard
          title={t("tools.publicUrlTitle")}
          description={publicUrl || t("tools.publicUrlDescription")}
          action={common("show")}
          busyLabel={t("tools.busy")}
          busy={busyAction === "public-url"}
          onClick={() => void fetchPublicUrl()}
        />
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}

function ToolCard({
  title,
  description,
  action,
  busyLabel,
  busy,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  busyLabel: string;
  busy: boolean;
  onClick: () => void;
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
  );
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
  );
}
