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
import { EntityGrid, EntityViewMenu } from "@/features/entity-control/ui/EntityCard"
import { useEntityViewPrefs, type EntityViewSort } from "@/shared/lib/ui-view-prefs"
import {
  EmptyState,
  CreateCard,
  FieldSelect,
  FilterChips,
  PageToolbar,
  StatusDot,
} from "@/shared/ui/page-toolbar"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Checkbox } from "@/shared/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover"
import { Switch } from "@/shared/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import {
  Boxes,
  MapPinned,
  Pencil,
  Plus,
  Radar,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { stackItemOffsetClass, stackRadiusClass } from "@/shared/lib/stack-radius"
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
        <div className="flex flex-col md:grid md:grid-cols-2 md:gap-2.5">
          {devices.map((d, i) => {
            const linked = entities.filter((e) => e.device_id === d.id)
            const onCount = linked.filter(isEntityActive).length
            const areaName = areas.find((a) => a.id === d.area_id)?.name
            return (
              <Card
                key={d.id}
                className={cn(
                  "iotvex-card-in transition-[transform,box-shadow,border-color] duration-300 hover:z-[1] hover:-translate-y-0.5 hover:border-white/[0.12] hover:shadow-[0_12px_40px_-18px_rgba(0,0,0,0.65)]",
                  stackRadiusClass(i, devices.length, "xl"),
                  stackItemOffsetClass(i),
                  "sm:mt-0 sm:rounded-xl sm:hover:-translate-y-0.5",
                  "max-sm:hover:translate-y-0",
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
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

      {devices.length > 0 ? (
        <CreateCard label={t("devices.discover")} onClick={discover} />
      ) : null}

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
  const { prefs, update: updatePrefs } = useEntityViewPrefs()
  const [q, setQ] = useState("")
  const sort = prefs.sort
  const setSort = (next: EntityViewSort) => updatePrefs({ sort: next })
  const [areaFilter, setAreaFilter] = useState("all")
  const [domainFilter, setDomainFilter] = useState("all")
  const [pending, start] = useTransition()
  const [edit, setEdit] = useState<{
    id: string
    name: string
    area_id: string
    device_id: string
    device_name: string
    enabled: boolean
  } | null>(null)

  const domains = useMemo(
    () => Array.from(new Set(entities.map((e) => e.domain))).sort(),
    [entities],
  )

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = entities.filter((e) => {
      if (areaFilter === "none" && e.area) return false
      if (areaFilter !== "all" && areaFilter !== "none" && e.area !== areaFilter) return false
      if (domainFilter !== "all" && e.domain !== domainFilter) return false
      if (!s) return true
      const deviceName = devices.find((d) => d.id === e.device_id)?.name?.toLowerCase() || ""
      return (
        e.name.toLowerCase().includes(s) ||
        e.domain.includes(s) ||
        deviceName.includes(s)
      )
    })

    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })
    list.sort((a, b) => {
      if (sort === "domain") {
        const byDomain = collator.compare(a.domain, b.domain)
        if (byDomain) return byDomain
        return collator.compare(a.name, b.name)
      }
      if (sort === "active") {
        const aOn = isEntityActive(a) ? 0 : 1
        const bOn = isEntityActive(b) ? 0 : 1
        if (aOn !== bOn) return aOn - bOn
        return collator.compare(a.name, b.name)
      }
      if (sort === "device") {
        const an = devices.find((d) => d.id === a.device_id)?.name || ""
        const bn = devices.find((d) => d.id === b.device_id)?.name || ""
        const byDevice = collator.compare(an, bn)
        if (byDevice) return byDevice
        return collator.compare(a.name, b.name)
      }
      const byName = collator.compare(a.name, b.name)
      return sort === "name_desc" ? -byName : byName
    })
    return list
  }, [entities, devices, q, areaFilter, domainFilter, sort])

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
        actions={
          <div className="flex w-full min-w-0 items-center gap-1.5">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("entities.searchPlaceholder")}
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
                    (areaFilter !== "all" || domainFilter !== "all") && "border border-primary/35 text-primary",
                  )}
                  aria-label={t("entities.filterAria")}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] space-y-3 p-3">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t("entities.allAreas")}
                  </div>
                  <FilterChips
                    value={areaFilter}
                    onChange={setAreaFilter}
                    items={[
                      { id: "all", label: t("entities.allAreas") },
                      { id: "none", label: t("entities.noArea") },
                      ...areas.map((a) => ({ id: a.id, label: a.name })),
                    ]}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t("entities.allDomains")}
                  </div>
                  <FilterChips
                    value={domainFilter}
                    onChange={setDomainFilter}
                    items={[
                      { id: "all", label: t("entities.allDomains") },
                      ...domains.map((d) => ({ id: d, label: d })),
                    ]}
                  />
                </div>
              </PopoverContent>
            </Popover>
            <EntityViewMenu
              groupByDevice={prefs.groupByDevice}
              sort={sort}
              onGroupByDeviceChange={(v) => updatePrefs({ groupByDevice: v })}
              onSortChange={(v) => setSort(v as EntityViewSort)}
            />
          </div>
        }
      />

      {areas.length > 0 && entities.some((e) => !e.area) ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-white/[0.03] px-3 py-3 text-xs text-muted-foreground backdrop-blur-md sm:flex-row sm:flex-wrap sm:items-center dark:bg-white/[0.03]">
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
          devices={devices}
          groupByDevice={prefs.groupByDevice}
          onEdit={(e) =>
            setEdit({
              id: e.entity_id,
              name: e.name,
              area_id: e.area || "",
              device_id: e.device_id || "",
              device_name: devices.find((d) => d.id === e.device_id)?.name || "",
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
                <Input
                  value={edit.device_name || t("entities.noDevice")}
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground">{t("entities.deviceLockedHint")}</p>
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
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()

  const entitiesByDevice = useMemo(() => {
    const map = new Map<string, typeof entities>()
    for (const e of entities) {
      const key = e.device_id || ""
      const list = map.get(key) || []
      list.push(e)
      map.set(key, list)
    }
    return map
  }, [entities])

  const orphanEntities = entitiesByDevice.get("") || []

  const resetSelection = (areaId: string | null) => {
    if (!areaId) {
      setSelectedDevices(new Set())
      setSelectedEntities(new Set())
      return
    }
    const entsInArea = new Set(
      entities.filter((e) => e.area === areaId).map((e) => e.entity_id),
    )
    setSelectedEntities(entsInArea)
    // Device belongs to the zone if it is assigned directly OR any of its entities are.
    const deviceIds = new Set<string>()
    for (const d of devices) {
      const linked = entities.filter((e) => e.device_id === d.id)
      const anyEntityHere = linked.some((e) => entsInArea.has(e.entity_id))
      if (d.area_id === areaId || anyEntityHere) {
        deviceIds.add(d.id)
      }
    }
    setSelectedDevices(deviceIds)
  }

  const openCreate = () => {
    setEditId(null)
    setName("")
    resetSelection(null)
    setOpen(true)
  }

  const openEdit = (id: string, current: string) => {
    setEditId(id)
    setName(current)
    resetSelection(id)
    setOpen(true)
  }

  const toggleDevice = (deviceId: string, on: boolean) => {
    const linked = entitiesByDevice.get(deviceId) || []
    setSelectedDevices((prev) => {
      const next = new Set(prev)
      if (on) next.add(deviceId)
      else next.delete(deviceId)
      return next
    })
    setSelectedEntities((prev) => {
      const next = new Set(prev)
      for (const e of linked) {
        if (on) next.add(e.entity_id)
        else next.delete(e.entity_id)
      }
      return next
    })
  }

  const toggleEntity = (entityId: string, deviceId: string | null | undefined, on: boolean) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev)
      if (on) next.add(entityId)
      else next.delete(entityId)

      if (deviceId) {
        const linked = entitiesByDevice.get(deviceId) || []
        setSelectedDevices((devs) => {
          const dnext = new Set(devs)
          // Device stays bound while at least one of its entities is selected.
          const anySelected = linked.some((e) => next.has(e.entity_id))
          if (anySelected) dnext.add(deviceId)
          else dnext.delete(deviceId)
          return dnext
        })
      }
      return next
    })
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
      if (!areaId) {
        setOpen(false)
        fetchCatalogFx()
        return
      }

      // Devices: bound if selected OR any of their entities stay in this zone.
      for (const d of devices) {
        const linked = entitiesByDevice.get(d.id) || []
        const anyEntitySelected = linked.some((e) => selectedEntities.has(e.entity_id))
        const should = selectedDevices.has(d.id) || anyEntitySelected
        const was = d.area_id === areaId
        if (should === was) continue
        await fetch("/api/devices", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: d.id,
            area_id: should ? areaId : null,
            cascade_area: false,
          }),
        })
      }

      // Entities: selected → assign; previously in zone but deselected → clear
      for (const e of entities) {
        const should = selectedEntities.has(e.entity_id)
        const was = e.area === areaId
        if (should === was) continue
        await fetch("/api/entities", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: e.entity_id,
            area_id: should ? areaId : null,
          }),
        })
      }

      setOpen(false)
      fetchCatalogFx()
    })
  }

  return (
    <div className="space-y-4">
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
        <div className="flex flex-col sm:grid sm:grid-cols-2 sm:gap-2.5 xl:grid-cols-3">
          {areas.map((a, i) => {
            const ents = entities.filter((e) => e.area === a.id)
            const entityDeviceIds = new Set(
              ents.map((e) => e.device_id).filter((id): id is string => Boolean(id)),
            )
            const devs = devices.filter(
              (d) => d.area_id === a.id || entityDeviceIds.has(d.id),
            )
            return (
              <Card
                key={a.id}
                className={cn(
                  "iotvex-card-in",
                  stackRadiusClass(i, areas.length, "xl"),
                  stackItemOffsetClass(i),
                  "sm:mt-0 sm:rounded-xl",
                )}
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-2.5 sm:p-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm sm:text-base">{a.name}</CardTitle>
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

      {areas.length > 0 ? (
        <CreateCard label={t("areas.add")} onClick={openCreate} />
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? t("areas.editTitle") : t("areas.newTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("areas.nameLabel")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("areas.namePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("areas.assignDevice")}</Label>
              <p className="text-[11px] text-muted-foreground">
                {t("areas.selectedCount", {
                  devices: selectedDevices.size,
                  entities: selectedEntities.size,
                })}
              </p>
              <ScrollArea className="h-[min(42vh,22rem)] rounded-xl border border-white/[0.08] bg-black/30">
                <div className="space-y-3 p-3">
                  {devices.map((d) => {
                    const linked = entitiesByDevice.get(d.id) || []
                    const selectedCount = linked.filter((e) =>
                      selectedEntities.has(e.entity_id),
                    ).length
                    const allOn = linked.length > 0 && selectedCount === linked.length
                    const someOn = selectedCount > 0
                    return (
                      <div key={d.id} className="space-y-1.5">
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/[0.03]">
                          <Checkbox
                            checked={allOn ? true : someOn ? "indeterminate" : false}
                            onCheckedChange={(v) => toggleDevice(d.id, v === true)}
                          />
                          <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">{d.name}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {linked.length}
                          </span>
                        </label>
                        {linked.length ? (
                          <div className="ml-7 space-y-0.5 border-l border-white/[0.06] pl-3">
                            {linked.map((e) => (
                              <label
                                key={e.entity_id}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-white/[0.03]"
                              >
                                <Checkbox
                                  checked={selectedEntities.has(e.entity_id)}
                                  onCheckedChange={(v) =>
                                    toggleEntity(e.entity_id, d.id, v === true)
                                  }
                                />
                                <span className="min-w-0 flex-1 break-words text-xs leading-snug text-muted-foreground">
                                  {e.name}
                                </span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}

                  {orphanEntities.length ? (
                    <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
                      <div className="px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("areas.orphanEntities")}
                      </div>
                      {orphanEntities.map((e) => (
                        <label
                          key={e.entity_id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-white/[0.03]"
                        >
                          <Checkbox
                            checked={selectedEntities.has(e.entity_id)}
                            onCheckedChange={(v) =>
                              toggleEntity(e.entity_id, null, v === true)
                            }
                          />
                          <span className="min-w-0 flex-1 break-words text-xs leading-snug text-muted-foreground">
                            {e.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {devices.length === 0 && orphanEntities.length === 0 ? (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                      {t("areas.skip")}
                    </p>
                  ) : null}
                </div>
              </ScrollArea>
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
