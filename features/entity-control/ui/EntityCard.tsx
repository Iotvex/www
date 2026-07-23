"use client"

import { callEntity, smoothToggleEntity } from "@/entities/device/model/store"
import { hasCapability } from "@/entities/device/model/capabilities"
import type { Device, EntityState } from "@/entities/device/model/types"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"
import { ColorPicker, type Rgb } from "@/shared/ui/color-picker"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import { FieldSelect } from "@/shared/ui/page-toolbar"
import { Slider } from "@/shared/ui/slider"
import { Switch } from "@/shared/ui/switch"
import { cn } from "@/shared/lib/utils"
import { stackItemOffsetClass, stackRadiusClass } from "@/shared/lib/stack-radius"
import {
  Atom,
  Binary,
  Cpu,
  Droplets,
  Gauge,
  LampCeiling,
  Lightbulb,
  MoreHorizontal,
  Pencil,
  Power,
  Sun,
  Thermometer,
  ToggleLeft,
  Wind,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"

function DomainIcon({ entity, className }: { entity: EntityState; className?: string }) {
  const cls = String(entity.attributes.device_class || "")
  const iconCls = cn("h-4 w-4", className)
  if (entity.domain === "light") return <LampCeiling className={iconCls} />
  if (entity.domain === "switch") return <ToggleLeft className={iconCls} />
  if (hasCapability(entity, "temperature") || cls === "temperature")
    return <Thermometer className={iconCls} />
  if (hasCapability(entity, "humidity") || cls === "humidity")
    return <Droplets className={iconCls} />
  if (cls === "illuminance") return <Sun className={iconCls} />
  if (cls === "pressure") return <Gauge className={iconCls} />
  if (cls === "carbon_dioxide" || cls === "co2") return <Wind className={iconCls} />
  if (hasCapability(entity, "binary")) return <Binary className={iconCls} />
  if (entity.domain === "sensor") return <Atom className={iconCls} />
  return <Power className={iconCls} />
}

function isSensorReading(entity: EntityState) {
  return (
    (entity.domain === "sensor" || entity.domain === "binary_sensor") &&
    hasCapability(entity, "value") &&
    !hasCapability(entity, "on_off")
  )
}

function unitOf(entity: EntityState) {
  return String(entity.attributes.unit_of_measurement || entity.attributes.unit || "")
}

function effectOptions(
  entity: EntityState,
  fallbackEffect: string,
): Array<{ id: number; name: string }> {
  const list = entity.attributes.effect_list
  if (Array.isArray(list) && list.length) {
    return list.map((name, id) => ({ id, name: String(name) }))
  }
  return [{ id: 0, name: fallbackEffect }]
}

/** Single entity controls — used inside a device card or as a standalone card body. */
export function EntityControls({
  entity,
  onEdit,
  compact,
}: {
  entity: EntityState
  onEdit?: (entity: EntityState) => void
  compact?: boolean
}) {
  const t = useTranslations("entity")
  const tActions = useTranslations("actions")
  const brightness = Number(entity.attributes.brightness ?? 128)
  const speed = Number(entity.attributes.speed ?? 128)
  const effect = Number(entity.attributes.effect ?? 0)
  const [localBri, setLocalBri] = useState(brightness)
  const [localSpeed, setLocalSpeed] = useState(speed)
  const [localRgb, setLocalRgb] = useState<Rgb>([255, 255, 255])
  const [toggling, setToggling] = useState(false)
  const on = entity.state === "on" || entity.state === "home" || entity.state === "open"
  const rgb = useMemo(() => {
    const c = (entity.attributes.rgb_color as number[]) || [255, 255, 255]
    return [c[0] ?? 255, c[1] ?? 255, c[2] ?? 255] as Rgb
  }, [entity.attributes.rgb_color])
  const briPct = Math.round((localBri / 255) * 100)
  const fallbackEffect = t("fallbackEffect")
  const effects = useMemo(() => effectOptions(entity, fallbackEffect), [entity, fallbackEffect])
  const sensor = isSensorReading(entity)
  const isLightStrip =
    hasCapability(entity, "brightness") ||
    hasCapability(entity, "color") ||
    hasCapability(entity, "effect")

  useEffect(() => setLocalBri(brightness), [brightness])
  useEffect(() => setLocalSpeed(speed), [speed])
  useEffect(() => setLocalRgb(rgb), [rgb])

  const commitColor = (next: Rgb) => {
    setLocalRgb(next)
    callEntity({
      entity_id: entity.entity_id,
      action: "set_color",
      r: next[0],
      g: next[1],
      b: next[2],
    })
  }

  const handlePower = async (next: boolean) => {
    if (toggling) return
    if (hasCapability(entity, "brightness")) {
      setToggling(true)
      try {
        await smoothToggleEntity(entity.entity_id, next)
      } finally {
        setToggling(false)
      }
      return
    }
    callEntity({
      entity_id: entity.entity_id,
      action: next ? "turn_on" : "turn_off",
    })
  }

  return (
    <div className={cn("space-y-2.5", compact ? "py-3" : "")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-muted-foreground backdrop-blur-md",
              entity.available && on && "border-primary/20 bg-primary/10 text-primary",
              sensor && entity.available && "border-white/[0.08] bg-white/[0.06] text-foreground/80",
            )}
          >
            <DomainIcon entity={entity} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-tight">{entity.name}</p>
            {!entity.available ? (
              <Badge variant="danger" className="mt-1 font-normal">
                {t("states.offline")}
              </Badge>
            ) : hasCapability(entity, "on_off") || hasCapability(entity, "binary") ? (
              <Badge
                variant="secondary"
                className={cn(
                  "mt-1 border-transparent font-normal",
                  on ? "bg-primary/15 text-primary" : "bg-white/[0.06] text-muted-foreground",
                )}
              >
                {on ? t("states.on") : t("states.off")}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onEdit ? (
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(entity)}>
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          {hasCapability(entity, "on_off") ? (
            <Switch
              className="shrink-0"
              aria-label={on ? tActions("turn_off") : tActions("turn_on")}
              checked={on}
              disabled={!entity.available || toggling}
              onCheckedChange={(next) => void handlePower(next)}
            />
          ) : null}
        </div>
      </div>

      {sensor ? (
        <div className="iotvex-stat-value flex items-baseline gap-1.5 pl-[2.875rem]">
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
            {entity.state}
          </span>
          {unitOf(entity) ? (
            <span className="text-sm font-medium text-muted-foreground">{unitOf(entity)}</span>
          ) : null}
        </div>
      ) : null}

      {isLightStrip ? (
        <div className={cn("space-y-3 pt-0.5", !on && "opacity-50")}>
          {hasCapability(entity, "brightness") ? (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("brightness")}</span>
                <span className="tabular-nums text-foreground/80">{briPct}%</span>
              </div>
              <Slider
                aria-label={tActions("set_brightness")}
                min={1}
                max={255}
                step={1}
                value={[localBri]}
                disabled={!entity.available || toggling}
                onValueChange={(v) => setLocalBri(v[0])}
                onValueCommit={(v) =>
                  callEntity({
                    entity_id: entity.entity_id,
                    action: "set_brightness",
                    brightness: v[0],
                  })
                }
              />
            </div>
          ) : null}

          {hasCapability(entity, "color") ? (
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">{t("colorLabel")}</div>
              <ColorPicker
                value={localRgb}
                disabled={!entity.available || toggling}
                onChange={setLocalRgb}
                onCommit={commitColor}
              />
            </div>
          ) : null}

          {hasCapability(entity, "effect") || hasCapability(entity, "speed") ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {hasCapability(entity, "effect") ? (
                <div className="min-w-0 space-y-1.5">
                  <div className="text-xs text-muted-foreground">{t("effect")}</div>
                  <FieldSelect
                    value={String(effect)}
                    disabled={!entity.available || toggling}
                    onChange={(v) =>
                      callEntity({
                        entity_id: entity.entity_id,
                        action: "set_effect",
                        effect: Number(v),
                        speed: localSpeed,
                      })
                    }
                  >
                    {effects.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </FieldSelect>
                </div>
              ) : null}
              {hasCapability(entity, "speed") ? (
                <div className="min-w-0 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t("speed")}</span>
                    <span className="tabular-nums text-foreground/80">{localSpeed}</span>
                  </div>
                  <Slider
                    aria-label={tActions("set_speed")}
                    min={0}
                    max={255}
                    step={1}
                    value={[localSpeed]}
                    disabled={!entity.available || toggling}
                    onValueChange={(v) => setLocalSpeed(v[0])}
                    onValueCommit={(v) =>
                      callEntity({
                        entity_id: entity.entity_id,
                        action: "set_speed",
                        speed: v[0],
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Standalone single-entity card (ungrouped mode). */
export function EntityCard({
  entity,
  className,
  onEdit,
  style,
}: {
  entity: EntityState
  className?: string
  onEdit?: (entity: EntityState) => void
  style?: CSSProperties
}) {
  return (
    <Card
      style={style}
      className={cn(
        "iotvex-card-in group relative min-w-0 overflow-hidden transition-[transform,box-shadow,background-color,border-color] duration-300",
        "hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-black/65 hover:shadow-[0_12px_40px_-18px_rgba(0,0,0,0.65)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-70" />
      <CardContent className="p-2.5 sm:p-3">
        <EntityControls entity={entity} onEdit={onEdit} />
      </CardContent>
    </Card>
  )
}

type DeviceGroup = {
  key: string
  title: string
  subtitle?: string
  entities: EntityState[]
}

export function groupEntitiesByDevice(
  entities: EntityState[],
  devices: Device[],
  unboundLabel: string,
): DeviceGroup[] {
  const byId = new Map(devices.map((d) => [d.id, d]))
  const buckets = new Map<string, EntityState[]>()

  for (const e of entities) {
    const key = e.device_id && byId.has(e.device_id) ? e.device_id : "__unbound__"
    const list = buckets.get(key)
    if (list) list.push(e)
    else buckets.set(key, [e])
  }

  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })
  const groups: DeviceGroup[] = []

  for (const [key, list] of buckets) {
    list.sort((a, b) => {
      const byDomain = collator.compare(a.domain, b.domain)
      if (byDomain) return byDomain
      const ai = Number(a.attributes.strip_index)
      const bi = Number(b.attributes.strip_index)
      if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai - bi
      return collator.compare(a.name, b.name)
    })
    const device = key === "__unbound__" ? null : byId.get(key)
    groups.push({
      key,
      title: device?.name || unboundLabel,
      subtitle: device
        ? [device.manufacturer, device.model].filter(Boolean).join(" · ") || undefined
        : undefined,
      entities: list,
    })
  }

  groups.sort((a, b) => {
    if (a.key === "__unbound__") return 1
    if (b.key === "__unbound__") return -1
    return collator.compare(a.title, b.title)
  })
  return groups
}

function DeviceEntityCard({
  group,
  onEdit,
  style,
  menu,
  stackIndex = 0,
  stackTotal = 1,
}: {
  group: DeviceGroup
  onEdit?: (entity: EntityState) => void
  style?: CSSProperties
  menu?: ReactNode
  stackIndex?: number
  stackTotal?: number
}) {
  const t = useTranslations("entity")
  const Icon = group.entities.some((e) => e.domain === "light")
    ? Lightbulb
    : group.entities.some((e) => e.domain === "sensor")
      ? Cpu
      : Power

  return (
    <div
      style={style}
      className={cn(
        "iotvex-card-in relative min-w-0 overflow-hidden border border-white/[0.07] bg-black/50 shadow-sm backdrop-blur-2xl transition-[transform,box-shadow,border-color,background-color] duration-300",
        "hover:z-[1] hover:border-white/[0.12] hover:bg-black/65 hover:shadow-[0_14px_44px_-18px_rgba(0,0,0,0.7)]",
        stackRadiusClass(stackIndex, stackTotal, "xl"),
        stackItemOffsetClass(stackIndex),
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="flex flex-row items-start justify-between gap-2 p-3 sm:p-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05] text-foreground/85 backdrop-blur-md">
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight">{group.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {group.subtitle || t("groupCount", { count: group.entities.length })}
            </p>
          </div>
        </div>
        {menu ? <div className="shrink-0">{menu}</div> : null}
      </div>

      <div className="flex flex-col">
        {group.entities.map((entity, index) => (
          <div
            key={entity.entity_id}
            className={cn(
              "border-t border-white/[0.06] px-3 sm:px-3.5",
              // Inner segments stay flush; outer card owns the stack radius.
            )}
          >
            <EntityControls entity={entity} onEdit={onEdit} compact />
          </div>
        ))}
      </div>
    </div>
  )
}

export function EntityGrid({
  entities,
  devices = [],
  empty,
  className,
  onEdit,
  groupByDevice = true,
  headerMenu,
}: {
  entities: EntityState[]
  devices?: Device[]
  empty?: ReactNode
  className?: string
  onEdit?: (entity: EntityState) => void
  groupByDevice?: boolean
  /** Optional menu rendered on each device card (right of title). */
  headerMenu?: (group: DeviceGroup) => ReactNode
}) {
  const t = useTranslations("entity")
  const groups = useMemo(
    () => groupEntitiesByDevice(entities, devices, t("unboundDevice")),
    [entities, devices, t],
  )

  if (!entities.length) {
    return empty ?? <p className="text-sm text-muted-foreground">{t("emptyEntities")}</p>
  }

  if (!groupByDevice) {
    return (
      <div className={cn("flex flex-col md:grid md:grid-cols-2 md:gap-2.5", className)}>
        {entities.map((e, i) => {
          const stacked = stackRadiusClass(i, entities.length, "xl")
          return (
            <EntityCard
              key={e.entity_id}
              entity={e}
              onEdit={onEdit}
              style={{ animationDelay: `${i * 35}ms` }}
              className={cn(
                "hover:z-[1] max-md:hover:translate-y-0",
                stackItemOffsetClass(i),
                stacked,
                // Restore independent cards from md up (override stack radius).
                "md:mt-0 md:rounded-xl",
              )}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {groups.map((group, gi) => (
        <DeviceEntityCard
          key={group.key}
          group={group}
          onEdit={onEdit}
          style={{ animationDelay: `${gi * 55}ms` }}
          menu={headerMenu?.(group)}
          stackIndex={gi}
          stackTotal={groups.length}
        />
      ))}
    </div>
  )
}

export function EntityViewMenu({
  groupByDevice,
  sort,
  onGroupByDeviceChange,
  onSortChange,
}: {
  groupByDevice: boolean
  sort: string
  onGroupByDeviceChange: (value: boolean) => void
  onSortChange: (value: string) => void
}) {
  const t = useTranslations("inventory.entities")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-10 w-10 shrink-0"
          aria-label={t("viewMenuAria")}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        <DropdownMenuLabel>{t("viewMenuLabel")}</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => onGroupByDeviceChange(true)}
          className="justify-between gap-3"
        >
          <span>{t("groupByDevice")}</span>
          {groupByDevice ? <span className="text-primary">✓</span> : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onGroupByDeviceChange(false)}
          className="justify-between gap-3"
        >
          <span>{t("ungroupDevices")}</span>
          {!groupByDevice ? <span className="text-primary">✓</span> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("sortAria")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={sort} onValueChange={onSortChange}>
          <DropdownMenuRadioItem value="device">{t("sortDevice")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="name_asc">{t("sortNameAsc")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="name_desc">{t("sortNameDesc")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="domain">{t("sortDomain")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="active">{t("sortActive")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
