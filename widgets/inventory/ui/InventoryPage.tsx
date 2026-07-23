"use client"

import { useUnit } from "effector-react"
import { useTranslations } from "next-intl"
import { isEntityActive } from "@/entities/device/model/capabilities"
import {
  $areas,
  $devices,
  $entities,
  $node,
  $nodes,
  fetchCatalogFx,
  fetchNodeFx,
} from "@/entities/device/model/store"
import { EntityGrid } from "@/features/entity-control/ui/EntityCard"
import {
  EmptyState,
  FieldSelect,
  FilterChips,
  PageToolbar,
  StatusDot,
} from "@/shared/ui/page-toolbar"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Switch } from "@/shared/ui/switch"
import {
  Boxes,
  MapPinned,
  Pencil,
  Plus,
  Radar,
  Trash2,
} from "lucide-react"
import { useMemo, useState, useTransition } from "react"

type InventoryTab = "devices" | "entities" | "areas"

export function InventoryPage({ tab = "devices" }: { tab?: InventoryTab }) {
  return (
    <div className="iotvex-page space-y-5">
      {tab === "devices" ? <DevicesTab /> : null}
      {tab === "entities" ? <EntitiesTab /> : null}
      {tab === "areas" ? <AreasTab /> : null}
    </div>
  )
}

function DevicesTab() {
  const t = useTranslations("inventory")
  const common = useTranslations("common")
  const devices = useUnit($devices)
  const entities = useUnit($entities)
  const areas = useUnit($areas)
  const node = useUnit($node)
  const nodes = useUnit($nodes)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [edit, setEdit] = useState<{
    id: string
    name: string
    area_id: string
    cascade: boolean
  } | null>(null)

  const discover = () => {
    start(async () => {
      setMsg(null)
      const res = await fetch("/api/devices/discover", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error || t("devices.discoverError"))
        return
      }
      setMsg(t("devices.discoverSuccess", { count: (data.entities || []).length }))
      fetchCatalogFx()
      fetchNodeFx()
    })
  }

  const save = () => {
    if (!edit) return
    start(async () => {
      await fetch("/api/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: edit.id,
          name: edit.name,
          area_id: edit.area_id || null,
          cascade_area: edit.cascade,
        }),
      })
      setEdit(null)
      fetchCatalogFx()
    })
  }

  return (
    <div className="space-y-4">
      <PageToolbar
        title={t("devices.title")}
        description={t("devices.description")}
        meta={
          <span className="inline-flex items-center gap-2">
            <StatusDot on={nodes.length > 0 || Boolean(node)} />
            {t("devices.count", { count: devices.length })}
            {nodes.length || node ? (
              <>
                {" · "}
                {t("devices.controllerOnline")}
                {" · "}
                {t("devices.nodesOnline", { count: nodes.length || (node ? 1 : 0) })}
                {node && node.strip_count > 0 ? (
                  <>
                    {" · "}
                    {t("devices.channels", { count: node.strip_count })}
                  </>
                ) : null}
              </>
            ) : (
              <>
                {" · "}
                {t("devices.controllerUnavailable")}
              </>
            )}
          </span>
        }
        actions={
          <Button size="sm" onClick={discover} disabled={pending}>
            <Radar className="h-4 w-4" />
            {t("devices.discover")}
          </Button>
        }
      />
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

      {devices.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-8 w-8" />}
          title={t("devices.emptyTitle")}
          description={t("devices.emptyDescription")}
          action={
            <Button size="sm" onClick={discover} disabled={pending}>
              <Radar className="h-4 w-4" />
              {t("devices.discover")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2 md:gap-2.5">
          {devices.map((d, i) => {
            const linked = entities.filter((e) => e.device_id === d.id)
            const onCount = linked.filter(isEntityActive).length
            const areaName = areas.find((a) => a.id === d.area_id)?.name
            return (
              <Card key={d.id} className="iotvex-card-in" style={{ animationDelay: `${i * 40}ms` }}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-2.5 sm:p-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm sm:text-base">{d.name}</CardTitle>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[d.manufacturer, d.model].filter(Boolean).join(" · ") || d.platform}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 self-start">
                    <Badge variant="secondary">{d.platform}</Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setEdit({
                          id: d.id,
                          name: d.name,
                          area_id: d.area_id || "",
                          cascade: true,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5 p-2.5 pt-0 text-sm text-muted-foreground sm:p-3 sm:pt-0">
                  <div className="flex items-center gap-2">
                    <StatusDot on={onCount > 0} />
                    {t("devices.onCount", { on: onCount, total: linked.length })}
                    {" · "}
                    {t("devices.areaLabel")}: {areaName || t("devices.unassignedArea")}
                  </div>
                  {linked.length ? (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {linked.map((e) => (
                        <Badge key={e.entity_id} variant="outline" className="font-normal">
                          {e.name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={Boolean(edit)} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("devices.settingsTitle")}</DialogTitle>
          </DialogHeader>
          {edit ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("devices.nameLabel")}</Label>
                <Input
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("devices.areaSelectLabel")}</Label>
                <FieldSelect
                  value={edit.area_id}
                  onChange={(v) => setEdit({ ...edit, area_id: v })}
                >
                  <option value="">{t("devices.noArea")}</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </FieldSelect>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm">
                <span>{t("devices.cascadeArea")}</span>
                <Switch
                  checked={edit.cascade}
                  onCheckedChange={(v) => setEdit({ ...edit, cascade: v })}
                />
              </label>
              <Button className="w-full" disabled={pending || !edit.name.trim()} onClick={save}>
                {common("save")}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EntitiesTab() {
  const t = useTranslations("inventory")
  const common = useTranslations("common")
  const entities = useUnit($entities)
  const areas = useUnit($areas)
  const devices = useUnit($devices)
  const [q, setQ] = useState("")
  const [areaFilter, setAreaFilter] = useState("all")
  const [domainFilter, setDomainFilter] = useState("all")
  const [pending, start] = useTransition()
  const [edit, setEdit] = useState<{
    id: string
    name: string
    area_id: string
    device_id: string
    enabled: boolean
  } | null>(null)

  const domains = useMemo(
    () => Array.from(new Set(entities.map((e) => e.domain))).sort(),
    [entities],
  )

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return entities.filter((e) => {
      if (areaFilter === "none" && e.area) return false
      if (areaFilter !== "all" && areaFilter !== "none" && e.area !== areaFilter) return false
      if (domainFilter !== "all" && e.domain !== domainFilter) return false
      if (!s) return true
      return (
        e.entity_id.toLowerCase().includes(s) ||
        e.name.toLowerCase().includes(s) ||
        e.domain.includes(s)
      )
    })
  }, [entities, q, areaFilter, domainFilter])

  const save = () => {
    if (!edit) return
    start(async () => {
      await fetch("/api/entities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: edit.id,
          name: edit.name,
          area_id: edit.area_id || null,
          device_id: edit.device_id || null,
          enabled: edit.enabled,
        }),
      })
      setEdit(null)
      fetchCatalogFx()
    })
  }

  const bindUnbound = (areaId: string) => {
    start(async () => {
      const unbound = entities.filter((e) => !e.area)
      for (const e of unbound) {
        await fetch("/api/entities", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: e.entity_id, area_id: areaId }),
        })
      }
      fetchCatalogFx()
    })
  }

  return (
    <div className="space-y-4">
      <PageToolbar
        title={t("entities.title")}
        description={<span className="hidden sm:inline">{t("entities.description")}</span>}
        meta={`${filtered.length} / ${entities.length}`}
        actions={
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("entities.searchPlaceholder")}
            className="h-10 w-full sm:h-9 sm:w-56"
          />
        }
      />

      <div className="space-y-2.5">
        <FilterChips
          value={areaFilter}
          onChange={setAreaFilter}
          items={[
            { id: "all", label: t("entities.allAreas") },
            { id: "none", label: t("entities.noArea") },
            ...areas.map((a) => ({ id: a.id, label: a.name })),
          ]}
        />
        <FilterChips
          value={domainFilter}
          onChange={setDomainFilter}
          items={[
            { id: "all", label: t("entities.allDomains") },
            ...domains.map((d) => ({ id: d, label: d })),
          ]}
        />
      </div>

      {areas.length > 0 && entities.some((e) => !e.area) ? (
        <div className="iotvex-glass-muted flex flex-col gap-2 rounded-2xl px-3 py-3 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center">
          <span className="shrink-0">{t("entities.unboundNotice")}</span>
          <div className="-mx-0.5 flex gap-1.5 overflow-x-auto overscroll-x-contain px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {areas.map((a) => (
              <Button
                key={a.id}
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={pending}
                onClick={() => bindUnbound(a.id)}
              >
                → {a.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {entities.length === 0 ? (
        <EmptyState
          title={t("entities.emptyTitle")}
          description={t("entities.emptyDescription")}
        />
      ) : (
        <EntityGrid
          entities={filtered}
          onEdit={(e) =>
            setEdit({
              id: e.entity_id,
              name: e.name,
              area_id: e.area || "",
              device_id: e.device_id || "",
              enabled: true,
            })
          }
        />
      )}

      <Dialog open={Boolean(edit)} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("entities.settingsTitle")}</DialogTitle>
          </DialogHeader>
          {edit ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("entities.nameLabel")}</Label>
                <Input
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("entities.deviceLabel")}</Label>
                <FieldSelect
                  value={edit.device_id}
                  onChange={(v) => setEdit({ ...edit, device_id: v })}
                >
                  <option value="">{t("entities.noDevice")}</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </FieldSelect>
              </div>
              <div className="space-y-1.5">
                <Label>{t("entities.areaLabel")}</Label>
                <FieldSelect
                  value={edit.area_id}
                  onChange={(v) => setEdit({ ...edit, area_id: v })}
                >
                  <option value="">{t("entities.noArea")}</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </FieldSelect>
              </div>
              <Button className="w-full" disabled={pending || !edit.name.trim()} onClick={save}>
                {common("save")}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AreasTab() {
  const t = useTranslations("inventory")
  const common = useTranslations("common")
  const areas = useUnit($areas)
  const entities = useUnit($entities)
  const devices = useUnit($devices)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [assignEntity, setAssignEntity] = useState("")
  const [assignDevice, setAssignDevice] = useState("")
  const [pending, start] = useTransition()

  const openCreate = () => {
    setEditId(null)
    setName("")
    setAssignEntity("")
    setAssignDevice("")
    setOpen(true)
  }

  const openEdit = (id: string, current: string) => {
    setEditId(id)
    setName(current)
    setAssignEntity("")
    setAssignDevice("")
    setOpen(true)
  }

  const save = () => {
    start(async () => {
      let areaId = editId
      if (editId) {
        await fetch("/api/areas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, name }),
        })
      } else {
        const res = await fetch("/api/areas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
        const data = await res.json()
        areaId = data.item?.id
      }
      if (areaId && assignEntity) {
        await fetch("/api/entities", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: assignEntity, area_id: areaId }),
        })
      }
      if (areaId && assignDevice) {
        await fetch("/api/devices", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: assignDevice, area_id: areaId, cascade_area: true }),
        })
      }
      setOpen(false)
      fetchCatalogFx()
    })
  }

  return (
    <div className="space-y-4">
      <PageToolbar
        title={t("areas.title")}
        description={t("areas.description")}
        meta={t("areas.count", { count: areas.length })}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t("areas.add")}
          </Button>
        }
      />
      {areas.length === 0 ? (
        <EmptyState
          icon={<MapPinned className="h-8 w-8" />}
          title={t("areas.emptyTitle")}
          description={t("areas.emptyDescription")}
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t("areas.add")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-2.5 xl:grid-cols-3">
          {areas.map((a, i) => {
            const ents = entities.filter((e) => e.area === a.id)
            const devs = devices.filter((d) => d.area_id === a.id)
            return (
              <Card key={a.id} className="iotvex-card-in" style={{ animationDelay: `${i * 35}ms` }}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-2.5 sm:p-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm sm:text-base">{a.name}</CardTitle>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{a.id}</p>
                  </div>
                  <div className="flex gap-0.5 self-start">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a.id, a.name)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        start(async () => {
                          await fetch(`/api/areas?id=${encodeURIComponent(a.id)}`, {
                            method: "DELETE",
                          })
                          fetchCatalogFx()
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5 p-2.5 pt-0 text-sm text-muted-foreground sm:p-3 sm:pt-0">
                  <div>
                    {devs.length} {t("areas.devicesAbbrev")} · {ents.length}{" "}
                    {t("areas.entitiesAbbrev")} · {ents.filter(isEntityActive).length}{" "}
                    {t("areas.onAbbrev")}
                  </div>
                  {ents.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {ents.slice(0, 8).map((e) => (
                        <Badge key={e.entity_id} variant="outline" className="font-normal">
                          {e.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs">{t("areas.nothingAssigned")}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? t("areas.editTitle") : t("areas.newTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("areas.nameLabel")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("areas.namePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("areas.assignDevice")}</Label>
              <FieldSelect value={assignDevice} onChange={setAssignDevice}>
                <option value="">{t("areas.skip")}</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </FieldSelect>
            </div>
            <div className="space-y-1.5">
              <Label>{t("areas.assignEntity")}</Label>
              <FieldSelect value={assignEntity} onChange={setAssignEntity}>
                <option value="">{t("areas.skip")}</option>
                {entities.map((e) => (
                  <option key={e.entity_id} value={e.entity_id}>
                    {e.name} ({e.entity_id})
                  </option>
                ))}
              </FieldSelect>
            </div>
            <Button className="w-full" disabled={!name.trim() || pending} onClick={save}>
              {editId ? common("save") : common("create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
