"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useUnit } from "effector-react";
import { ArrowDown, ArrowUp, Cpu, House, Lightbulb, MoreHorizontal, Pencil, Radio, Trash2 } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  EmptyState,
  FieldSelect,
  PageToolbar,
  StatusDot,
} from "@/shared/ui/page-toolbar";
import { isEntityActive } from "@/entities/device/model/capabilities";
import {
  $areas,
  $devices,
  $entities,
  $agentConnection,
  $agentOnline,
  $node,
  type AgentConnection,
} from "@/entities/device/model/store";
import { setView } from "@/entities/nav/model/store";

type Entity = {
  id?: string;
  entity_id?: string;
  name?: string;
  friendly_name?: string;
  domain?: string;
  state?: string;
  available?: boolean;
  capabilities?: string[];
  area?: string | null;
  area_id?: string | null;
  device_id?: string | null;
  attributes?: Record<string, unknown>;
};

type Area = {
  id?: string;
  area_id?: string;
  name?: string;
};

type Device = {
  id?: string;
  name?: string;
  area_id?: string;
};

type NodeStatus = {
  id?: string;
  name?: string;
  online?: boolean;
  status?: string;
  version?: string;
  host?: string;
  strip_count?: number;
  strips?: Array<{ on?: boolean }>;
  ts?: number;
};

type WidgetKind = "entities" | "lights" | "area" | "status" | "activity";

type DashboardWidget = {
  id: string;
  title: string;
  kind: WidgetKind;
  sort_order?: number;
  config?: {
    area_id?: string;
  };
};

type EventItem = {
  id?: string;
  title?: string;
  type?: string;
  kind?: string;
  detail?: string;
  message?: string;
  entity_id?: string | null;
  created_at?: string;
};

type ApiList<T> = {
  items: T[];
};

type OverviewTranslations = ReturnType<typeof useTranslations>;

const WIDGET_KIND_VALUES: WidgetKind[] = ["entities", "lights", "area", "status", "activity"];

function getWidgetKindOptions(t: OverviewTranslations): Array<{ value: WidgetKind; label: string }> {
  return WIDGET_KIND_VALUES.map((value) => ({
    value,
    label: t(`widgets.kinds.${value}`),
  }));
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, T>);
  }

  return [];
}

function idOf(value: Entity | Area | Device): string {
  return value.id ?? ("entity_id" in value ? value.entity_id : undefined) ?? ("area_id" in value ? value.area_id : undefined) ?? "";
}

function entityId(entity: Entity): string {
  return entity.entity_id ?? entity.id ?? "";
}

function entityName(entity: Entity): string {
  const friendlyName = entity.attributes?.friendly_name;
  return (
    entity.name ??
    entity.friendly_name ??
    (typeof friendlyName === "string" ? friendlyName : undefined) ??
    entityId(entity)
  );
}

function areaName(area: Area, fallback: string): string {
  return area.name ?? area.area_id ?? area.id ?? fallback;
}

function isLight(entity: Entity): boolean {
  const id = entityId(entity);
  return entity.domain === "light" || id.startsWith("light.");
}

async function api<T>(
  url: string,
  init?: RequestInit,
  requestError?: (status: number) => string,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || requestError?.(response.status) || "");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function OverviewPage() {
  const t = useTranslations("overview");
  const common = useTranslations("common");
  const rawDevices = useUnit($devices);
  const rawEntities = useUnit($entities);
  const rawAreas = useUnit($areas);
  const node = useUnit($node) as NodeStatus | null;
  const agentOnline = useUnit($agentOnline);
  const agentConnection = useUnit($agentConnection);
  const navigate = useUnit(setView);

  const devices = useMemo(() => asArray<Device>(rawDevices), [rawDevices]);
  const entities = useMemo(() => asArray<Entity>(rawEntities), [rawEntities]);
  const areas = useMemo(() => asArray<Area>(rawAreas), [rawAreas]);

  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DashboardWidget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestError = useCallback((status: number) => t("requestError", { status }), [t]);

  const loadWidgets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ApiList<DashboardWidget>>("/api/dashboard/widgets", undefined, requestError);
      setWidgets(sortWidgets(data.items));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("widgets.loadError"));
    } finally {
      setLoading(false);
    }
  }, [requestError, t]);

  useEffect(() => {
    void loadWidgets();
  }, [loadWidgets]);

  const removeWidget = async (widget: DashboardWidget) => {
    if (!confirm(t("widgets.deleteConfirm", { title: widget.title }))) {
      return;
    }

    try {
      await api(`/api/dashboard/widgets/${widget.id}`, { method: "DELETE" }, requestError);
      setWidgets((current) => current.filter((candidate) => candidate.id !== widget.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("widgets.deleteError"));
    }
  };

  const moveWidget = async (widget: DashboardWidget, direction: -1 | 1) => {
    const ordered = sortWidgets(widgets);
    const index = ordered.findIndex((candidate) => candidate.id === widget.id);
    const target = ordered[index + direction];

    if (!target) {
      return;
    }

    const nextOrder = target.sort_order ?? index + direction;
    const targetOrder = widget.sort_order ?? index;

    try {
      await Promise.all([
        api(
          `/api/dashboard/widgets/${widget.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ sort_order: nextOrder }),
          },
          requestError,
        ),
        api(
          `/api/dashboard/widgets/${target.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ sort_order: targetOrder }),
          },
          requestError,
        ),
      ]);
      await loadWidgets();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("widgets.orderError"));
    }
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (widget: DashboardWidget) => {
    setEditing(widget);
    setDialogOpen(true);
  };

  return (
    <div className="iotvex-page min-w-0 space-y-4 sm:space-y-6">
      <PageToolbar
        title={t("toolbar.title")}
        description={
          <span className="hidden sm:inline">{t("toolbar.description")}</span>
        }
        actions={
          <Button size="sm" onClick={openCreate}>
            {t("toolbar.addWidget")}
          </Button>
        }
      />

      {widgets.some((w) => w.kind === "status") ? null : (
        <StatsRow
          devices={devices.length}
          entities={entities.length}
          entitiesOn={entities.filter(isEntityActive).length}
          areas={areas.length}
          areaHint={areas[0]?.name}
          agentOnline={agentOnline}
          agentConnection={agentConnection}
          stripCount={Number(node?.strip_count ?? node?.strips?.length ?? 0)}
          onHome={() => navigate("home-devices")}
          onSettings={() => navigate("settings-account")}
        />
      )}

      {error ? (
        <Card className="iotvex-card-in border-destructive/30">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {!loading && widgets.length === 0 ? (
        <EmptyState
          title={t("widgets.emptyTitle")}
          description={t("widgets.emptyDescription")}
          action={
            <Button size="sm" onClick={openCreate}>
              {t("widgets.addFirstWidget")}
            </Button>
          }
        />
      ) : null}

      <div className="grid min-w-0 gap-2 sm:gap-2.5 lg:grid-cols-2">
        {sortWidgets(widgets).map((widget, index, ordered) => (
          <Card key={widget.id} className="iotvex-card-in min-w-0 overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-2.5 sm:p-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-sm sm:text-base">{widget.title}</CardTitle>
                <CardDescription className="truncate text-xs">
                  {kindLabel(widget.kind, widget.config, areas, t)}
                </CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="shrink-0"
                    aria-label={t("widgets.menuAria")}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={index === 0}
                    onSelect={() => void moveWidget(widget, -1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                    {t("widgets.moveUp")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={index === ordered.length - 1}
                    onSelect={() => void moveWidget(widget, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                    {t("widgets.moveDown")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => openEdit(widget)}>
                    <Pencil className="h-4 w-4" />
                    {common("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => void removeWidget(widget)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {common("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="min-w-0 overflow-hidden p-2.5 pt-0 sm:p-3 sm:pt-0">
              <WidgetBody
                widget={widget}
                entities={entities}
                areas={areas}
                devices={devices}
                node={node}
                agentOnline={agentOnline}
                agentConnection={agentConnection}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <WidgetDialog
        widget={editing}
        areas={areas}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={loadWidgets}
      />
    </div>
  );
}

function StatsRow({
  devices,
  entities,
  entitiesOn,
  areas,
  areaHint,
  agentOnline,
  agentConnection,
  stripCount,
  onHome,
  onSettings,
}: {
  devices: number;
  entities: number;
  entitiesOn: number;
  areas: number;
  areaHint?: string;
  agentOnline: boolean;
  agentConnection: AgentConnection;
  stripCount: number;
  onHome: () => void;
  onSettings: () => void;
}) {
  const t = useTranslations("overview");
  const connectionValue =
    agentConnection === "pending"
      ? t("stats.checkingValue")
      : agentOnline
        ? t("stats.onlineValue")
        : t("stats.offlineValue");
  const connectionHint =
    agentConnection === "pending"
      ? t("stats.checkingHint")
      : agentOnline
        ? stripCount
          ? t("stats.channels", { count: stripCount })
          : t("stats.controllerAvailable")
        : t("stats.agentNoResponse");
  const connectionTone =
    agentConnection === "pending" ? "neutral" : agentOnline ? "good" : "bad";
  const items = [
    {
      label: t("stats.devices"),
      value: String(devices),
      hint: devices ? t("stats.devicesInCatalog") : t("stats.devicesAddInHome"),
      icon: <Cpu className="h-3.5 w-3.5" />,
      onClick: onHome,
      tone: "neutral" as const,
    },
    {
      label: t("stats.entities"),
      value: String(entities),
      hint: entities ? t("stats.entitiesOn", { count: entitiesOn }) : t("stats.entitiesWaitingDiscovery"),
      icon: <Lightbulb className="h-3.5 w-3.5" />,
      onClick: onHome,
      tone: "neutral" as const,
    },
    {
      label: t("stats.rooms"),
      value: String(areas),
      hint: areaHint ? t("stats.roomExample", { name: areaHint }) : t("stats.roomsUnassigned"),
      icon: <House className="h-3.5 w-3.5" />,
      onClick: onHome,
      tone: "neutral" as const,
    },
    {
      label: t("stats.connection"),
      value: connectionValue,
      hint: connectionHint,
      icon: <Radio className="h-3.5 w-3.5" />,
      onClick: onSettings,
      tone: connectionTone as "good" | "bad" | "neutral",
    },
  ];

  return (
    <div className="iotvex-glass iotvex-stat-panel min-w-0 overflow-hidden rounded-2xl">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => (
          <StatButton
            key={item.label}
            {...item}
            delayMs={40 + index * 60}
            lastInRow={index % 2 === 1}
            lastInDesktop={index === items.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function StatButton({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  onClick,
  delayMs = 0,
  lastInRow,
  lastInDesktop,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone?: "neutral" | "good" | "bad";
  onClick: () => void;
  delayMs?: number;
  lastInRow?: boolean;
  lastInDesktop?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick();
        e.currentTarget.blur();
      }}
      style={{ animationDelay: `${delayMs}ms` }}
      className={[
        "iotvex-stat-cell group relative flex min-h-[4.25rem] min-w-0 flex-col justify-between gap-1.5 px-2.5 py-2 text-left outline-none transition-colors sm:min-h-[4.75rem] sm:gap-2 sm:px-3 sm:py-2.5",
        "hover:bg-white/[0.04] focus-visible:bg-white/[0.06]",
        "border-border/40",
        lastInRow ? "" : "border-r",
        "border-b lg:border-b-0",
        lastInDesktop ? "lg:border-r-0" : "lg:border-r",
      ].join(" ")}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="text-muted-foreground/80">{icon}</span>
          {label}
        </span>
        {tone !== "neutral" ? <StatusDot tone={tone} /> : null}
      </span>
      <span>
        <span className="iotvex-stat-value block text-xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        <span className="mt-0.5 block truncate text-[10px] leading-tight text-muted-foreground">
          {hint}
        </span>
      </span>
    </button>
  );
}

function WidgetDialog({
  widget,
  areas,
  open,
  onOpenChange,
  onSaved,
}: {
  widget: DashboardWidget | null;
  areas: Area[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("overview");
  const common = useTranslations("common");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<WidgetKind>("entities");
  const [areaId, setAreaId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestError = useCallback((status: number) => t("requestError", { status }), [t]);
  const widgetKindOptions = useMemo(() => getWidgetKindOptions(t), [t]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTitle(widget?.title ?? "");
    setKind(widget?.kind ?? "entities");
    setAreaId(widget?.config?.area_id ?? idOf(areas[0] ?? {}));
    setError(null);
  }, [areas, open, widget]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        kind,
        config: kind === "area" ? { area_id: areaId } : {},
      };

      await api(
        widget ? `/api/dashboard/widgets/${widget.id}` : "/api/dashboard/widgets",
        {
          method: widget ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
        requestError,
      );
      onOpenChange(false);
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("widgets.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{widget ? t("widgets.editTitle") : t("widgets.newTitle")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="widget-title">{t("widgets.nameLabel")}</Label>
            <Input
              id="widget-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("widgets.namePlaceholder")}
            />
          </div>

          <FieldSelect
            label={t("widgets.typeLabel")}
            value={kind}
            onValueChange={(value: string) => setKind(value as WidgetKind)}
            options={widgetKindOptions}
          />

          {kind === "area" ? (
            <FieldSelect
              label={t("widgets.roomLabel")}
              value={areaId}
              onValueChange={setAreaId}
              options={areas.map((area) => ({
                value: idOf(area),
                label: areaName(area, t("widgets.unnamed")),
              }))}
            />
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {common("cancel")}
          </Button>
          <Button
            onClick={() => void save()}
            disabled={saving || !title.trim() || (kind === "area" && !areaId)}
          >
            {saving ? common("saving") : common("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WidgetBody({
  widget,
  entities,
  areas,
  devices,
  node,
  agentOnline,
  agentConnection,
}: {
  widget: DashboardWidget;
  entities: Entity[];
  areas: Area[];
  devices: Device[];
  node: NodeStatus | null;
  agentOnline: boolean;
  agentConnection: AgentConnection;
}) {
  const t = useTranslations("overview");

  if (widget.kind === "status") {
    const pending = agentConnection === "pending";
    const online = agentOnline;
    const onCount = entities.filter(isEntityActive).length;
    const strips = Number(node?.strip_count ?? node?.strips?.length ?? 0);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/20 px-2.5 py-2">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">{t("statusWidget.controller")}</p>
            <p className="truncate text-sm font-medium">
              {pending
                ? t("stats.checkingHint")
                : online
                  ? node?.host || t("statusWidget.localAgent")
                  : t("statusWidget.noConnection")}
            </p>
          </div>
          <Badge variant={pending ? "secondary" : online ? "success" : "danger"} className="shrink-0">
            <span className="mr-1.5 inline-flex">
              <StatusDot tone={pending ? "neutral" : online ? "good" : "bad"} />
            </span>
            {pending
              ? t("stats.checkingValue")
              : online
                ? t("stats.onlineValue")
                : t("stats.offlineValue")}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <MiniStat
            label={t("statusWidget.catalog")}
            value={`${devices.length} ${t("statusWidget.devicesAbbrev")}`}
          />
          <MiniStat label={t("statusWidget.active")} value={`${onCount}/${entities.length}`} />
          <MiniStat label={t("statusWidget.channels")} value={strips || "—"} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t("statusWidget.roomsCount", { count: areas.length })}
          {areas[0]?.name ? ` · ${areas.map((a) => a.name).slice(0, 2).join(", ")}` : ""}
        </p>
      </div>
    );
  }

  if (widget.kind === "activity") {
    return <ActivityList />;
  }

  const areaId = widget.kind === "area" ? widget.config?.area_id : undefined;
  const source = entities.filter((entity) => {
    if (widget.kind === "lights" && !isLight(entity)) {
      return false;
    }

    if (areaId && (entity.area ?? entity.area_id) !== areaId) {
      return false;
    }

    return true;
  });

  if (source.length === 0) {
    return (
      <EmptyState
        title={t("widgets.noMatchingTitle")}
        description={
          widget.kind === "area"
            ? t("widgets.noMatchingAreaDescription", { room: areaNameById(areaId, areas, t) })
            : t("widgets.noMatchingGenericDescription")
        }
      />
    );
  }

  return (
    <div className="grid gap-1.5">
      {source.slice(0, 8).map((entity) => (
        <div
          key={entityId(entity)}
          className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/20 px-2.5 py-2"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-sm">{entityName(entity)}</p>
            <p className="truncate text-xs text-muted-foreground">{entityId(entity)}</p>
          </div>
          <Badge variant={entity.state === "on" ? "default" : "secondary"}>
            {entity.state ?? t("widgets.noData")}
          </Badge>
        </div>
      ))}
      {source.length > 8 ? (
        <p className="text-xs text-muted-foreground">{t("widgets.andMore", { count: source.length - 8 })}</p>
      ) : null}
    </div>
  );
}

function ActivityList() {
  const t = useTranslations("overview");
  const locale = useLocale();
  const [items, setItems] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestError = useCallback((status: number) => t("requestError", { status }), [t]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await api<ApiList<EventItem>>("/api/events?limit=8", undefined, requestError);
        if (active) {
          setItems(data.items);
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : t("activityWidget.loadError"));
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [requestError, t]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (items.length === 0) {
    return <EmptyState title={t("activityWidget.emptyTitle")} description={t("activityWidget.emptyDescription")} />;
  }

  return (
    <div className="grid gap-1.5">
      {items.map((event, index) => (
        <div
          key={event.id ?? `${event.created_at}-${index}`}
          className="rounded-lg border border-border/50 bg-background/20 px-2.5 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-medium text-sm">{event.title ?? event.type ?? t("activityWidget.fallbackTitle")}</p>
            {event.created_at ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(event.created_at).toLocaleString(locale)}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {[event.detail, event.entity_id].filter(Boolean).join(" · ") || event.kind || ""}
          </p>
        </div>
      ))}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/20 px-2 py-1.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold tabular-nums">
        {tone ? <StatusDot tone={tone} /> : null}
        {value}
      </p>
    </div>
  );
}

function sortWidgets(items: DashboardWidget[]): DashboardWidget[] {
  return [...items].sort(
    (left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0) || left.title.localeCompare(right.title),
  );
}

function kindLabel(
  kind: WidgetKind,
  config: DashboardWidget["config"],
  areas: Area[],
  t: OverviewTranslations,
): string {
  if (kind === "area") {
    return t("widgets.kindArea", { room: areaNameById(config?.area_id, areas, t) });
  }

  return t(`widgets.kinds.${kind}`);
}

function areaNameById(areaId: string | undefined, areas: Area[], t: OverviewTranslations): string {
  if (!areaId) {
    return t("widgets.noRoomSelected");
  }

  return areaName(areas.find((area) => idOf(area) === areaId) ?? { id: areaId }, t("widgets.unnamed"));
}
