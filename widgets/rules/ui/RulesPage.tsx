"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import {
  EmptyState,
  CreateCard,
  FieldSelect,
  PageToolbar,
  SegmentedTabs,
} from "@/shared/ui/page-toolbar";
import { $entities } from "@/entities/device/model/store";
import {
  AutomationEditor,
  actionLabel,
  triggerLabel,
  type AutomationItem,
  type AutomationAction,
} from "./AutomationEditor";

type Entity = {
  id?: string;
  entity_id?: string;
  name?: string;
  friendly_name?: string;
  domain?: string;
  state?: string;
  area?: string | null;
  area_id?: string | null;
  device_id?: string | null;
  attributes?: Record<string, unknown>;
  capabilities?: string[];
};

type SceneItem = {
  id: string;
  name: string;
  entity_ids?: string[];
  entity_count?: number;
  created_at?: string;
};

type ScriptItem = {
  id: string;
  name: string;
  actions?: AutomationAction[];
  action_label?: string;
};

type ApiList<T> = {
  items: T[];
};

type RuleTab = "automations" | "scenes" | "scripts";
type ActionKind = "turn_on" | "turn_off" | "toggle";

const ACTION_OPTIONS = [
  { value: "turn_on", labelKey: "turn_on" },
  { value: "turn_off", labelKey: "turn_off" },
  { value: "toggle", labelKey: "toggle" },
] as const;

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, T>);
  }

  return [];
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
    throw new Error(message || requestError?.(response.status) || `Request error ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}





export function RulesPage({ tab = "automations" }: { tab?: RuleTab }) {
  return (
    <div className="iotvex-page space-y-6">
      {tab === "automations" ? <AutomationsPanel /> : null}
      {tab === "scenes" ? <ScenesPanel /> : null}
      {tab === "scripts" ? <ScriptsPanel /> : null}
    </div>
  );
}

function AutomationsPanel() {
  const t = useTranslations("rules");
  const tEditor = useTranslations("automationEditor");
  const common = useTranslations("common");
  const requestError = (status: number) => t("requestError", { status });
  const rawEntities = useUnit($entities);
  const entities = useMemo(() => asArray<Entity>(rawEntities), [rawEntities]);
  const [items, setItems] = useState<AutomationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationItem | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ApiList<AutomationItem>>("/api/automations", undefined, requestError);
      setItems(data.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("automations.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleEnabled = async (item: AutomationItem, enabled: boolean) => {
    const previous = items;
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, enabled } : candidate,
      ),
    );

    try {
      await api(`/api/automations/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }, requestError);
    } catch (cause) {
      setItems(previous);
      setError(cause instanceof Error ? cause.message : t("automations.updateError"));
    }
  };

  const remove = async (item: AutomationItem) => {
    if (!confirm(t("automations.deleteConfirm", { name: item.name }))) {
      return;
    }

    try {
      await api(`/api/automations/${item.id}`, { method: "DELETE" }, requestError);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("automations.deleteError"));
    }
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (item: AutomationItem) => {
    setEditing(item);
    setDialogOpen(true);
  };

  return (
    <section className="space-y-4">
      <PageToolbar
        title={t("automations.title")}
        description={<span className="hidden sm:inline">{t("automations.description")}</span>}
        actions={
          <Button size="sm" onClick={openCreate}>
            {t("automations.create")}
          </Button>
        }
      />

      {error ? (
        <Card className="iotvex-card-in border-destructive/30">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          title={t("automations.emptyTitle")}
          description={t("automations.emptyDescription")}
          action={
            <Button size="sm" onClick={openCreate}>
              {t("automations.create")}
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-2">
        {items.map((item) => (
          <Card key={item.id} className="iotvex-card-in min-w-0 overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-2.5 sm:p-3">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <CardTitle className="truncate text-sm sm:text-base">{item.name}</CardTitle>
                  <Badge variant={item.enabled === false ? "secondary" : "success"}>
                    {item.enabled === false ? t("automations.inactive") : t("automations.active")}
                  </Badge>
                </div>
                <CardDescription className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{triggerLabel(item, tEditor)}</Badge>
                  <Badge variant="outline">{actionLabel(item, tEditor)}</Badge>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 self-start">
                <Switch
                  checked={item.enabled !== false}
                  onCheckedChange={(checked: boolean) => void toggleEnabled(item, checked)}
                  aria-label={t("automations.enableAria")}
                />
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5 p-2.5 pt-0 sm:p-3 sm:pt-0">
              <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                {common("edit")}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void remove(item)}>
                {common("delete")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length > 0 ? (
        <CreateCard label={t("automations.create")} onClick={openCreate} />
      ) : null}

      <AutomationEditor
        entities={entities}
        item={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
      />
    </section>
  );
}

function ScenesPanel() {
  const t = useTranslations("rules");
  const common = useTranslations("common");
  const requestError = (status: number) => t("requestError", { status });
  const rawEntities = useUnit($entities);
  const entities = useMemo(() => asArray<Entity>(rawEntities), [rawEntities]);
  const [items, setItems] = useState<SceneItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ApiList<SceneItem>>("/api/scenes", undefined, requestError);
      setItems(data.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("scenes.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const activate = async (scene: SceneItem) => {
    try {
      await api(`/api/scenes/${scene.id}/activate`, { method: "POST" }, requestError);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("scenes.activateError"));
    }
  };

  const remove = async (scene: SceneItem) => {
    if (!confirm(t("scenes.deleteConfirm", { name: scene.name }))) {
      return;
    }

    try {
      await api(`/api/scenes/${scene.id}`, { method: "DELETE" }, requestError);
      setItems((current) => current.filter((candidate) => candidate.id !== scene.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("scenes.deleteError"));
    }
  };

  return (
    <section className="space-y-4">
      <PageToolbar
        title={t("scenes.title")}
        description={<span className="hidden sm:inline">{t("scenes.description")}</span>}
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            {t("scenes.create")}
          </Button>
        }
      />

      {error ? (
        <Card className="iotvex-card-in border-destructive/30">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          title={t("scenes.emptyTitle")}
          description={t("scenes.emptyDescription")}
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              {t("scenes.create")}
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-2 md:grid-cols-2 md:gap-2.5">
        {items.map((scene) => (
          <Card key={scene.id} className="iotvex-card-in">
            <CardHeader className="p-2.5 sm:p-3">
              <CardTitle className="text-sm sm:text-base">{scene.name}</CardTitle>
              <CardDescription>
                {t("scenes.entityCount", {
                  count: scene.entity_count ?? scene.entity_ids?.length ?? 0,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5 p-2.5 pt-0 sm:p-3 sm:pt-0">
              <Button size="sm" onClick={() => void activate(scene)}>
                {common("activate")}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void remove(scene)}>
                {common("delete")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length > 0 ? (
        <CreateCard label={t("scenes.create")} onClick={() => setDialogOpen(true)} />
      ) : null}

      <SceneDialog
        entities={entities}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
      />
    </section>
  );
}

function SceneDialog({
  entities,
  open,
  onOpenChange,
  onSaved,
}: {
  entities: Entity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("rules");
  const common = useTranslations("common");
  const requestError = (status: number) => t("requestError", { status });
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"manual" | "capture">("manual");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [capturedIds, setCapturedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setMode("manual");
      setSelectedEntity(entityId(entities[0] ?? {}));
      setCapturedIds([]);
      setError(null);
    }
  }, [entities, open]);

  const toggleCaptured = (id: string, checked: boolean) => {
    setCapturedIds((current) =>
      checked ? [...current, id] : current.filter((candidate) => candidate !== id),
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode === "capture") {
        await api("/api/scenes/capture", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), entity_ids: capturedIds }),
        }, requestError);
      } else {
        await api("/api/scenes", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), entity_ids: [selectedEntity] }),
        }, requestError);
      }

      onOpenChange(false);
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("scenes.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const disabled =
    saving ||
    !name.trim() ||
    (mode === "manual" ? !selectedEntity : capturedIds.length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("scenes.newTitle")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="scene-name">{common("name")}</Label>
            <Input
              id="scene-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("scenes.namePlaceholder")}
            />
          </div>

          <SegmentedTabs
            value={mode}
            onValueChange={(value: string) => setMode(value as "manual" | "capture")}
            items={[
              { value: "manual", label: t("scenes.modeManual") },
              { value: "capture", label: t("scenes.modeCapture") },
            ]}
          />

          {mode === "manual" ? (
            <FieldSelect
              label={t("scenes.sceneDevice")}
              value={selectedEntity}
              onValueChange={setSelectedEntity}
              options={entities.map((entity) => ({
                value: entityId(entity),
                label: entityName(entity),
              }))}
            />
          ) : (
            <div className="grid max-h-72 gap-2 overflow-auto rounded-lg border p-3">
              {entities.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("scenes.noAvailableEntities")}</p>
              ) : null}
              {entities.map((entity) => {
                const id = entityId(entity);
                return (
                  <label
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <span>{entityName(entity)}</span>
                    <input
                      type="checkbox"
                      checked={capturedIds.includes(id)}
                      onChange={(event) => toggleCaptured(id, event.target.checked)}
                    />
                  </label>
                );
              })}
            </div>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {common("cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={disabled}>
            {saving ? common("saving") : common("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScriptsPanel() {
  const t = useTranslations("rules");
  const tEditor = useTranslations("automationEditor");
  const common = useTranslations("common");
  const requestError = (status: number) => t("requestError", { status });
  const rawEntities = useUnit($entities);
  const entities = useMemo(() => asArray<Entity>(rawEntities), [rawEntities]);
  const [items, setItems] = useState<ScriptItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ApiList<ScriptItem>>("/api/scripts", undefined, requestError);
      setItems(data.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("scripts.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const run = async (script: ScriptItem) => {
    try {
      await api(`/api/scripts/${script.id}/run`, { method: "POST" }, requestError);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("scripts.runError"));
    }
  };

  const remove = async (script: ScriptItem) => {
    if (!confirm(t("scripts.deleteConfirm", { name: script.name }))) {
      return;
    }

    try {
      await api(`/api/scripts/${script.id}`, { method: "DELETE" }, requestError);
      setItems((current) => current.filter((candidate) => candidate.id !== script.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("scripts.deleteError"));
    }
  };

  return (
    <section className="space-y-4">
      <PageToolbar
        title={t("scripts.title")}
        description={<span className="hidden sm:inline">{t("scripts.description")}</span>}
        actions={
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            {t("scripts.create")}
          </Button>
        }
      />

      {error ? (
        <Card className="iotvex-card-in border-destructive/30">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          title={t("scripts.emptyTitle")}
          description={t("scripts.emptyDescription")}
          action={
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              {t("scripts.create")}
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-2">
        {items.map((script) => (
          <Card key={script.id} className="iotvex-card-in">
            <CardHeader className="p-2.5 sm:p-3">
              <CardTitle className="text-sm sm:text-base">{script.name}</CardTitle>
              <CardDescription>{actionLabel(script, tEditor)}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5 p-2.5 pt-0 sm:p-3 sm:pt-0">
              <Button size="sm" onClick={() => void run(script)}>
                {common("run")}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void remove(script)}>
                {common("delete")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length > 0 ? (
        <CreateCard label={t("scripts.create")} onClick={() => setDialogOpen(true)} />
      ) : null}

      <ScriptDialog
        entities={entities}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
      />
    </section>
  );
}

function ScriptDialog({
  entities,
  open,
  onOpenChange,
  onSaved,
}: {
  entities: Entity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("rules");
  const tActions = useTranslations("actions");
  const common = useTranslations("common");
  const requestError = (status: number) => t("requestError", { status });
  const [name, setName] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [action, setAction] = useState<ActionKind>("toggle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setSelectedEntity(entityId(entities[0] ?? {}));
      setAction("toggle");
      setError(null);
    }
  }, [entities, open]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const entity = entities.find((e) => entityId(e) === selectedEntity);
      const domain = entity?.domain || selectedEntity.split(".")[0] || "home";
      await api("/api/scripts", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          sequence: [
            {
              action: `${domain}.${action}`,
              target: { entity_id: selectedEntity },
              data: action === "turn_on" ? { brightness_pct: 50 } : {},
            },
          ],
        }),
      }, requestError);
      onOpenChange(false);
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("scripts.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("scripts.newTitle")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="script-name">{common("name")}</Label>
            <Input
              id="script-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("scripts.namePlaceholder")}
            />
          </div>

          <FieldSelect
            label={t("scripts.entityLabel")}
            value={selectedEntity}
            onValueChange={setSelectedEntity}
            options={entities.map((entity) => ({
              value: entityId(entity),
              label: entityName(entity),
            }))}
          />

          <FieldSelect
            label={t("scripts.actionLabel")}
            value={action}
            onValueChange={(value: string) => setAction(value as ActionKind)}
            options={ACTION_OPTIONS.map((option) => ({
              value: option.value,
              label: tActions(option.labelKey),
            }))}
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {common("cancel")}
          </Button>
          <Button
            onClick={() => void save()}
            disabled={saving || !name.trim() || !selectedEntity}
          >
            {saving ? common("saving") : common("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

