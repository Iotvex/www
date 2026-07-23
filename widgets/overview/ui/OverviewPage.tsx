"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useUnit } from "effector-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Cpu,
  GripVertical,
  House,
  Lightbulb,
  MoreHorizontal,
  Pencil,
  Radio,
  Trash2,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { cn } from "@/shared/lib/utils";
import { stackItemOffsetClass, stackItemOffsetStyle, stackRadiusStyle } from "@/shared/lib/stack-radius";

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
  CreateCard,
  FieldSelect,
  StatusDot,
} from "@/shared/ui/page-toolbar";
import { PageListSkeleton, StatsSkeleton } from "@/shared/ui/skeleton";
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
import { EntityGrid } from "@/features/entity-control/ui/EntityCard";
import type { DeviceDomain, EntityCapability, EntityState } from "@/entities/device/model/types";
import { useDashboardEntityViewPrefs } from "@/shared/lib/ui-view-prefs";

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
  id: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  area_id?: string | null;
  platform?: string;
  external_id?: string | null;
  meta?: Record<string, unknown>;
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

  const orderedWidgets = useMemo(() => sortWidgets(widgets), [widgets]);
  const usedKinds = useMemo(
    () => new Set(orderedWidgets.map((widget) => widget.kind)),
    [orderedWidgets],
  );
  const availableKinds = useMemo(
    () => WIDGET_KIND_VALUES.filter((kind) => !usedKinds.has(kind)),
    [usedKinds],
  );
  const canAddWidget = availableKinds.length > 0;

  const persistOrder = useCallback(
    async (ordered: DashboardWidget[]) => {
      const withOrder = ordered.map((widget, index) => ({ ...widget, sort_order: index }));
      setWidgets(withOrder);
      try {
        await Promise.all(
          withOrder.map((widget) =>
            api(
              `/api/dashboard/widgets/${widget.id}`,
              {
                method: "PATCH",
                body: JSON.stringify({ sort_order: widget.sort_order }),
              },
              requestError,
            ),
          ),
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t("widgets.orderError"));
        await loadWidgets();
      }
    },
    [loadWidgets, requestError, t],
  );

  const moveWidget = async (widget: DashboardWidget, direction: number) => {
    const ordered = sortWidgets(widgets);
    const index = ordered.findIndex((candidate) => candidate.id === widget.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }
    await persistOrder(arrayMove(ordered, index, targetIndex));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const ordered = sortWidgets(widgets);
    const oldIndex = ordered.findIndex((widget) => widget.id === active.id);
    const newIndex = ordered.findIndex((widget) => widget.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    void persistOrder(arrayMove(ordered, oldIndex, newIndex));
  };

  const openCreate = () => {
    if (!canAddWidget) {
      return;
    }
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (widget: DashboardWidget) => {
    setEditing(widget);
    setDialogOpen(true);
  };

  return (
    <div className="iotvex-page min-w-0 space-y-4 sm:space-y-6">
      {loading ? (
        <>
          <StatsSkeleton />
          <PageListSkeleton rows={4} dual />
        </>
      ) : (
        <>
          {widgets.some((w) => w.kind === "status") ? null : (
            <StatsRow
              devices={devices.length}
              entities={entities.length}
              areas={areas.length}
              agentOnline={agentOnline}
              agentConnection={agentConnection}
              onHome={() => navigate("home-devices")}
              onSettings={() => navigate("settings-account")}
            />
          )}

          {error ? (
            <Card className="iotvex-card-in border-destructive/30">
              <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
            </Card>
          ) : null}

          {widgets.length === 0 ? (
            <EmptyState
              title={t("widgets.emptyTitle")}
              description={t("widgets.emptyDescription")}
              action={
                canAddWidget ? (
                  <Button size="sm" onClick={openCreate}>
                    {t("widgets.addFirstWidget")}
                  </Button>
                ) : null
              }
            />
          ) : null}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={orderedWidgets.map((widget) => widget.id)} strategy={rectSortingStrategy}>
              <div className="grid min-w-0 gap-2 sm:gap-2.5 lg:grid-cols-2">
                {orderedWidgets.map((widget, index) => (
                  <SortableWidgetCard
                    key={widget.id}
                    widget={widget}
                    index={index}
                    total={orderedWidgets.length}
                    areas={areas}
                    entities={entities}
                    devices={devices}
                    node={node}
                    agentOnline={agentOnline}
                    agentConnection={agentConnection}
                    onMove={(direction) => void moveWidget(widget, direction)}
                    onEdit={() => openEdit(widget)}
                    onRemove={() => void removeWidget(widget)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {widgets.length > 0 && canAddWidget ? (
            <CreateCard label={t("toolbar.addWidget")} onClick={openCreate} />
          ) : null}
        </>
      )}

      <WidgetDialog
        widget={editing}
        widgets={orderedWidgets}
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
  areas,
  agentOnline,
  agentConnection,
  onHome,
  onSettings,
}: {
  devices: number;
  entities: number;
  areas: number;
  agentOnline: boolean;
  agentConnection: AgentConnection;
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
  const connectionTone =
    agentConnection === "pending" ? "neutral" : agentOnline ? "good" : "bad";
  const items = [
    {
      label: t("stats.agentStatus"),
      value: connectionValue,
      icon: <Radio className="h-3.5 w-3.5" />,
      onClick: onSettings,
      tone: connectionTone as "good" | "bad" | "neutral",
    },
    {
      label: t("stats.devices"),
      value: String(devices),
      icon: <Cpu className="h-3.5 w-3.5" />,
      onClick: onHome,
      tone: "neutral" as const,
    },
    {
      label: t("stats.entities"),
      value: String(entities),
      icon: <Lightbulb className="h-3.5 w-3.5" />,
      onClick: onHome,
      tone: "neutral" as const,
    },
    {
      label: t("stats.rooms"),
      value: String(areas),
      icon: <House className="h-3.5 w-3.5" />,
      onClick: onHome,
      tone: "neutral" as const,
    },
  ];

  return (
    <div className="iotvex-stat-panel min-w-0 overflow-hidden rounded-xl border border-white/[0.06] bg-black/50 backdrop-blur-xl">
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
  icon,
  tone = "neutral",
  onClick,
  delayMs = 0,
  lastInRow,
  lastInDesktop,
}: {
  label: string;
  value: string;
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
        "iotvex-stat-cell group relative flex min-h-[4.25rem] min-w-0 flex-col justify-between gap-1.5 px-2.5 py-2.5 text-left outline-none transition-colors sm:min-h-[4.75rem] sm:gap-2 sm:px-3 sm:py-3",
        "hover:bg-white/[0.04] focus-visible:bg-white/[0.06]",
        "border-white/[0.05]",
        lastInRow ? "" : "border-r",
        "border-b lg:border-b-0",
        lastInDesktop ? "lg:border-r-0" : "lg:border-r",
      ].join(" ")}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="text-muted-foreground/70">{icon}</span>
          {label}
        </span>
        {tone !== "neutral" ? <StatusDot tone={tone} /> : null}
      </span>
      <span className="iotvex-stat-value block text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </span>
    </button>
  );
}

function SortableWidgetCard({
  widget,
  index,
  total,
  areas,
  entities,
  devices,
  agentOnline,
  agentConnection,
  onMove,
  onEdit,
  onRemove,
}: {
  widget: DashboardWidget;
  index: number;
  total: number;
  areas: Area[];
  entities: Entity[];
  devices: Device[];
  node: NodeStatus | null;
  agentOnline: boolean;
  agentConnection: AgentConnection;
  onMove: (direction: number) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("overview");
  const common = useTranslations("common");
  const { prefs: dashPrefs, update: updateDashPrefs } = useDashboardEntityViewPrefs();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });
  const showEntityViewOpts =
    widget.kind === "entities" || widget.kind === "lights" || widget.kind === "area";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "iotvex-card-in relative min-w-0 overflow-hidden touch-manipulation",
        isDragging && "opacity-90 shadow-lg ring-1 ring-primary/30",
      )}
    >
      <CardHeader
        className={
          widget.kind === "status"
            ? "absolute right-1.5 top-1.5 z-10 flex flex-row items-start justify-end gap-0.5 space-y-0 p-0"
            : "flex flex-row items-start justify-between gap-2 space-y-0 p-2.5 sm:p-3"
        }
      >
        <div className="flex min-w-0 items-start gap-1.5">
          <button
            type="button"
            className="mt-0.5 shrink-0 cursor-grab rounded-md p-1 text-muted-foreground hover:bg-white/[0.05] hover:text-foreground active:cursor-grabbing"
            aria-label={t("widgets.dragAria")}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            {widget.kind === "status" ? null : (
              <>
                <CardTitle className="truncate text-sm sm:text-base">{widget.title}</CardTitle>
                {widget.kind === "area" ? (
                  <CardDescription className="truncate text-xs">
                    {kindLabel(widget.kind, widget.config, areas, t)}
                  </CardDescription>
                ) : null}
              </>
            )}
          </div>
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
            <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
              <ArrowLeft className="h-4 w-4" />
              {t("widgets.moveLeft")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index >= total - 1} onSelect={() => onMove(1)}>
              <ArrowRight className="h-4 w-4" />
              {t("widgets.moveRight")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index < 2} onSelect={() => onMove(-2)}>
              <ArrowUp className="h-4 w-4" />
              {t("widgets.moveUp")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index + 2 >= total} onSelect={() => onMove(2)}>
              <ArrowDown className="h-4 w-4" />
              {t("widgets.moveDown")}
            </DropdownMenuItem>
            {showEntityViewOpts ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => updateDashPrefs({ groupByDevice: true })}>
                  {t("widgets.groupByDevice")}
                  {dashPrefs.groupByDevice ? <span className="ml-auto text-primary">✓</span> : null}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => updateDashPrefs({ groupByDevice: false })}>
                  {t("widgets.ungroupDevices")}
                  {!dashPrefs.groupByDevice ? <span className="ml-auto text-primary">✓</span> : null}
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="h-4 w-4" />
              {common("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onRemove}>
              <Trash2 className="h-4 w-4" />
              {common("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent
        className={
          widget.kind === "status"
            ? "min-w-0 overflow-hidden p-0"
            : "min-w-0 overflow-hidden p-2.5 pt-0 sm:p-3 sm:pt-0"
        }
      >
        <WidgetBody
          widget={widget}
          entities={entities}
          areas={areas}
          devices={devices}
          node={node}
          agentOnline={agentOnline}
          agentConnection={agentConnection}
          groupByDevice={dashPrefs.groupByDevice}
        />
      </CardContent>
    </Card>
  );
}

function WidgetDialog({
  widget,
  widgets,
  areas,
  open,
  onOpenChange,
  onSaved,
}: {
  widget: DashboardWidget | null;
  widgets: DashboardWidget[];
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
  const [titleTouched, setTitleTouched] = useState(false);
  const requestError = useCallback((status: number) => t("requestError", { status }), [t]);

  const usedKinds = useMemo(() => {
    const set = new Set(widgets.map((item) => item.kind));
    if (widget) {
      set.delete(widget.kind);
    }
    return set;
  }, [widget, widgets]);

  const kindOptions = useMemo(
    () =>
      WIDGET_KIND_VALUES.filter((value) => !usedKinds.has(value)).map((value) => ({
        value,
        label: t(`widgets.kinds.${value}`),
      })),
    [t, usedKinds],
  );

  const defaultTitleFor = useCallback(
    (value: WidgetKind) => t(`widgets.kinds.${value}`),
    [t],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (widget) {
      setTitle(widget.title);
      setKind(widget.kind);
      setAreaId(widget.config?.area_id ?? idOf(areas[0] ?? {}));
      setTitleTouched(true);
    } else {
      const initialKind = kindOptions[0]?.value ?? "entities";
      setKind(initialKind);
      setTitle(defaultTitleFor(initialKind));
      setAreaId(idOf(areas[0] ?? {}));
      setTitleTouched(false);
    }
    setError(null);
  }, [areas, defaultTitleFor, kindOptions, open, widget]);

  const onKindChange = (value: string) => {
    const nextKind = value as WidgetKind;
    setKind(nextKind);
    if (!titleTouched || !title.trim() || title.trim() === defaultTitleFor(kind)) {
      setTitle(defaultTitleFor(nextKind));
      setTitleTouched(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim() || defaultTitleFor(kind),
        kind,
        config: kind === "area" ? { area_id: areaId } : {},
        sort_order: widget?.sort_order ?? widgets.length,
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
      <DialogContent className="shadow-none">
        <DialogHeader>
          <DialogTitle>{widget ? t("widgets.editTitle") : t("widgets.newTitle")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="widget-title">{t("widgets.nameLabel")}</Label>
            <Input
              id="widget-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleTouched(true);
              }}
              placeholder={defaultTitleFor(kind)}
            />
          </div>

          <FieldSelect
            label={t("widgets.typeLabel")}
            value={kind}
            onValueChange={onKindChange}
            options={kindOptions.length ? kindOptions : [{ value: kind, label: t(`widgets.kinds.${kind}`) }]}
            disabled={!widget && kindOptions.length === 0}
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
            className="shadow-none"
            onClick={() => void save()}
            disabled={
              saving ||
              (!widget && kindOptions.length === 0) ||
              (kind === "area" && !areaId)
            }
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
  agentOnline,
  agentConnection,
  groupByDevice = true,
}: {
  widget: DashboardWidget;
  entities: Entity[];
  areas: Area[];
  devices: Device[];
  node?: NodeStatus | null;
  agentOnline: boolean;
  agentConnection: AgentConnection;
  groupByDevice?: boolean;
}) {
  const t = useTranslations("overview");

  if (widget.kind === "status") {
    const pending = agentConnection === "pending";
    const online = agentOnline;
    const agentValue = pending
      ? t("stats.checkingValue")
      : online
        ? t("stats.onlineValue")
        : t("stats.offlineValue");
    const agentTone = pending ? "neutral" : online ? "good" : "bad";
    return (
      <div className="grid grid-cols-2 overflow-hidden rounded-xl">
        <MiniStat
          label={t("stats.agentStatus")}
          value={agentValue}
          tone={agentTone}
          className="border-b border-r border-white/[0.05]"
        />
        <MiniStat
          label={t("stats.devices")}
          value={devices.length}
          className="border-b border-white/[0.05]"
        />
        <MiniStat
          label={t("stats.entities")}
          value={entities.length}
          className="border-r border-white/[0.05]"
        />
        <MiniStat label={t("stats.rooms")} value={areas.length} />
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

  const deviceModels = devices
    .filter((d): d is Device & { id: string; name: string } => Boolean(d.id && d.name))
    .map((d) => ({
      id: d.id,
      name: d.name,
      manufacturer: d.manufacturer ?? null,
      model: d.model ?? null,
      area_id: d.area_id ?? null,
      platform: d.platform ?? "iotvex",
      external_id: d.external_id ?? null,
      meta: d.meta || {},
    }))

  const flatLimit = 8
  const limited = source.slice(0, flatLimit)
  const normalized: EntityState[] = limited.map((entity) => ({
    entity_id: entityId(entity),
    domain: (entity.domain || "other") as DeviceDomain,
    name: entityName(entity),
    state: String(entity.state ?? ""),
    attributes: (entity.attributes as Record<string, unknown>) || {},
    capabilities: (entity.capabilities || []) as EntityCapability[],
    area: (entity.area ?? entity.area_id ?? undefined) || undefined,
    device_id: entity.device_id ?? null,
    available: entity.available !== false,
  }))

  return (
    <div className="min-w-0">
      <EntityGrid
        entities={normalized}
        devices={deviceModels}
        groupByDevice={groupByDevice}
      />
      {source.length > flatLimit ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t("widgets.andMore", { count: source.length - flatLimit })}
        </p>
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
    <div className="flex min-w-0 flex-col">
      {items.map((event, index) => (
        <div
          key={event.id ?? `${event.created_at}-${index}`}
          className={cn(
            "min-w-0 border border-white/[0.1] bg-white/[0.04] px-2.5 py-2",
            stackItemOffsetClass(index),
          )}
          style={{ ...stackItemOffsetStyle(index), ...stackRadiusStyle(index, items.length, "xl") }}
        >
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="min-w-0 flex-1 break-words font-medium text-sm leading-snug">
              {event.title ?? event.type ?? t("activityWidget.fallbackTitle")}
            </p>
            {event.created_at ? (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {new Date(event.created_at).toLocaleString(locale)}
              </span>
            ) : null}
          </div>
          <p className="iotvex-hide-scroll mt-0.5 min-w-0 overflow-x-auto whitespace-nowrap text-xs text-muted-foreground">
            {event.detail || event.kind || ""}
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
  className = "",
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "good" | "bad";
  className?: string;
}) {
  return (
    <div className={`flex min-h-[4.25rem] flex-col justify-between gap-1.5 px-2.5 py-2.5 ${className}`}>
      <p className="flex items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground">
        <span>{label}</span>
        {tone && tone !== "neutral" ? <StatusDot tone={tone} /> : null}
      </p>
      <p className="text-xl font-semibold tracking-tight tabular-nums">{value}</p>
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
