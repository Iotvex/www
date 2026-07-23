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
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover"
import { Slider } from "@/shared/ui/slider"
import { Switch } from "@/shared/ui/switch"
import {
  byteToPct,
  effectSupportsColor,
  effectSupportsSpeed,
  pctToByte,
} from "@/shared/lib/home/action-options"
import { cn } from "@/shared/lib/utils"
import { stackItemOffsetClass, stackItemOffsetStyle, stackRadiusClass, stackRadiusStyle } from "@/shared/lib/stack-radius"
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
  Timer,
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

function PercentValuePopover({
  open,
  onOpenChange,
  icon,
  label,
  value,
  disabled,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: ReactNode
  label: string
  value: number
  disabled?: boolean
  onApply: (pct: number) => void
}) {
  const t = useTranslations("entity")
  const common = useTranslations("common")
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(String(value))
      setError(null)
    }
  }, [open, value])

  const submit = () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setError(t("manualValueRequired"))
      return
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n < 1 || n > 100 || !Number.isInteger(n)) {
      setError(t("manualValueRange"))
      return
    }
    setError(null)
    onApply(n)
    onOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          title={label}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-muted-foreground transition-colors",
            "hover:border-white/20 hover:text-foreground",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          {icon}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 space-y-2.5 p-3">
        <div className="space-y-1.5">
          <Label htmlFor={`pct-${label}`} className="text-xs">
            {label}
          </Label>
          <Input
            id={`pct-${label}`}
            inputMode="numeric"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                submit()
              }
            }}
            aria-invalid={Boolean(error)}
          />
          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
        </div>
        <Button type="button" size="sm" className="w-full" onClick={submit}>
          {common("confirm")}
        </Button>
      </PopoverContent>
    </Popover>
  )
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
  const [localBriPct, setLocalBriPct] = useState(() => byteToPct(brightness))
  const [localSpeedPct, setLocalSpeedPct] = useState(() => byteToPct(speed))
  const [localRgb, setLocalRgb] = useState<Rgb>([255, 255, 255])
  const [toggling, setToggling] = useState(false)
  const [briOpen, setBriOpen] = useState(false)
  const [speedOpen, setSpeedOpen] = useState(false)
  const on = entity.state === "on" || entity.state === "home" || entity.state === "open"
  const rgb = useMemo(() => {
    const c = (entity.attributes.rgb_color as number[]) || [255, 255, 255]
    return [c[0] ?? 255, c[1] ?? 255, c[2] ?? 255] as Rgb
  }, [entity.attributes.rgb_color])
  const fallbackEffect = t("fallbackEffect")
  const effects = useMemo(() => effectOptions(entity, fallbackEffect), [entity, fallbackEffect])
  const sensor = isSensorReading(entity)
  const isLightStrip =
    hasCapability(entity, "brightness") ||
    hasCapability(entity, "color") ||
    hasCapability(entity, "effect")
  const showColor =
    hasCapability(entity, "color") && effectSupportsColor(effect)
  const showSpeed =
    hasCapability(entity, "speed") && effectSupportsSpeed(effect)
  const showBrightness = hasCapability(entity, "brightness")
  const showEffect = hasCapability(entity, "effect")

  useEffect(() => setLocalBriPct(byteToPct(brightness)), [brightness])
  useEffect(() => setLocalSpeedPct(byteToPct(speed)), [speed])
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

  const commitBrightnessPct = (pct: number) => {
    const next = Math.max(1, Math.min(100, Math.round(pct)))
    setLocalBriPct(next)
    callEntity({
      entity_id: entity.entity_id,
      action: "set_brightness",
      brightness: pctToByte(next),
    })
  }

  const commitSpeedPct = (pct: number) => {
    const next = Math.max(1, Math.min(100, Math.round(pct)))
    setLocalSpeedPct(next)
    callEntity({
      entity_id: entity.entity_id,
      action: "set_speed",
      speed: pctToByte(next),
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

  if (sensor) {
    return (
      <div className={cn("flex items-center gap-2.5", compact ? "py-2" : "py-1")}>
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] text-foreground/75",
            !entity.available && "opacity-50",
          )}
        >
          <DomainIcon entity={entity} className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-tight text-foreground/90">
              {entity.name}
            </p>
            {!entity.available ? (
              <Badge variant="danger" className="shrink-0 font-normal">
                {t("states.offline")}
              </Badge>
            ) : (
              <p className="iotvex-stat-value shrink-0 text-right text-[13px] font-semibold tabular-nums tracking-tight text-foreground">
                <span>{entity.state}</span>
                {unitOf(entity) ? (
                  <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                    {unitOf(entity)}
                  </span>
                ) : null}
              </p>
            )}
          </div>
        </div>
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={() => onEdit(entity)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", compact ? "py-2.5" : "")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-muted-foreground backdrop-blur-md",
              entity.available && on && "border-primary/20 bg-primary/10 text-primary",
            )}
          >
            <DomainIcon entity={entity} className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-tight">{entity.name}</p>
            {!entity.available ? (
              <Badge variant="danger" className="mt-0.5 font-normal">
                {t("states.offline")}
              </Badge>
            ) : hasCapability(entity, "on_off") || hasCapability(entity, "binary") ? (
              <Badge
                variant="secondary"
                className={cn(
                  "mt-0.5 border-transparent font-normal",
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

      {isLightStrip ? (
        <div className={cn("space-y-2.5 pt-0.5", !on && "opacity-50")}>
          {showBrightness || showSpeed ? (
            <div
              className={cn(
                "grid gap-2.5",
                showBrightness && showSpeed ? "grid-cols-2" : "grid-cols-1",
              )}
            >
              {showBrightness ? (
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <PercentValuePopover
                      open={briOpen}
                      onOpenChange={setBriOpen}
                      icon={<Sun className="h-3.5 w-3.5" />}
                      label={t("brightness")}
                      value={localBriPct}
                      disabled={!entity.available || toggling}
                      onApply={commitBrightnessPct}
                    />
                    <span className="tabular-nums text-xs text-foreground/80">{localBriPct}%</span>
                  </div>
                  <Slider
                    aria-label={tActions("set_brightness")}
                    min={1}
                    max={100}
                    step={1}
                    value={[localBriPct]}
                    disabled={!entity.available || toggling}
                    onValueChange={(v) => setLocalBriPct(v[0])}
                    onValueCommit={(v) => commitBrightnessPct(v[0])}
                  />
                </div>
              ) : null}
              {showSpeed ? (
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <PercentValuePopover
                      open={speedOpen}
                      onOpenChange={setSpeedOpen}
                      icon={<Timer className="h-3.5 w-3.5" />}
                      label={t("speed")}
                      value={localSpeedPct}
                      disabled={!entity.available || toggling}
                      onApply={commitSpeedPct}
                    />
                    <span className="tabular-nums text-xs text-foreground/80">{localSpeedPct}%</span>
                  </div>
                  <Slider
                    aria-label={tActions("set_speed")}
                    min={1}
                    max={100}
                    step={1}
                    value={[localSpeedPct]}
                    disabled={!entity.available || toggling}
                    onValueChange={(v) => setLocalSpeedPct(v[0])}
                    onValueCommit={(v) => commitSpeedPct(v[0])}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {showColor || showEffect ? (
            <div
              className={cn(
                "grid gap-2.5",
                showColor && showEffect ? "grid-cols-2" : "grid-cols-1",
              )}
            >
              {showColor ? (
                <div className="min-w-0 space-y-1.5">
                  <div className="text-xs text-muted-foreground">{t("colorLabel")}</div>
                  <ColorPicker
                    value={localRgb}
                    disabled={!entity.available || toggling}
                    onChange={setLocalRgb}
                    onCommit={commitColor}
                  />
                </div>
              ) : null}
              {showEffect ? (
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
                        speed: pctToByte(localSpeedPct),
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
      style={{ ...style, ...stackItemOffsetStyle(stackIndex), ...stackRadiusStyle(stackIndex, stackTotal, "xl") }}
      className={cn(
        "iotvex-card-in relative min-w-0 overflow-hidden border border-white/[0.1] bg-black/50 transition-[background-color,box-shadow] duration-300",
        "hover:z-[1] hover:bg-black/60",
        stackItemOffsetClass(stackIndex),
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      <div className="flex flex-row items-center justify-between gap-2 px-3 py-2.5 sm:px-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-foreground/85 backdrop-blur-md">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">{group.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {group.subtitle || t("groupCount", { count: group.entities.length })}
            </p>
          </div>
        </div>
        {menu ? <div className="shrink-0">{menu}</div> : null}
      </div>

      <div className="flex flex-col">
        {group.entities.map((entity) => (
          <div key={entity.entity_id} className="min-w-0">
            <div className="h-px w-full bg-white/[0.08]" aria-hidden />
            <div className="px-2.5 sm:px-3">
              <EntityControls entity={entity} onEdit={onEdit} compact />
            </div>
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
        {entities.map((e, i) => (
          <EntityCard
            key={e.entity_id}
            entity={e}
            onEdit={onEdit}
            style={{ animationDelay: `${i * 35}ms` }}
            className={cn(
              "hover:z-[1] max-md:hover:translate-y-0",
              stackItemOffsetClass(i),
              stackRadiusClass(i, entities.length, "xl"),
              "md:mt-0 md:rounded-xl",
            )}
          />
        ))}
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
