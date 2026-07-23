"use client"

import { callEntity, smoothToggleEntity } from "@/entities/device/model/store"
import { hasCapability } from "@/entities/device/model/capabilities"
import type { Device, EntityState } from "@/entities/device/model/types"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { ColorPicker, type Rgb } from "@/shared/ui/color-picker"
import { FieldSelect } from "@/shared/ui/page-toolbar"
import { Slider } from "@/shared/ui/slider"
import { Switch } from "@/shared/ui/switch"
import { cn } from "@/shared/lib/utils"
import {
  Binary,
  Droplets,
  Gauge,
  Lightbulb,
  Pencil,
  Power,
  Thermometer,
  ToggleLeft,
  Wind,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"

function DomainIcon({ entity }: { entity: EntityState }) {
  const cls = entity.attributes.device_class
  if (entity.domain === "light") return <Lightbulb className="h-4 w-4" />
  if (entity.domain === "switch") return <ToggleLeft className="h-4 w-4" />
  if (hasCapability(entity, "temperature") || cls === "temperature")
    return <Thermometer className="h-4 w-4" />
  if (hasCapability(entity, "humidity") || cls === "humidity")
    return <Droplets className="h-4 w-4" />
  if (cls === "carbon_dioxide" || cls === "co2") return <Wind className="h-4 w-4" />
  if (cls === "illuminance" || cls === "pressure") return <Gauge className="h-4 w-4" />
  if (hasCapability(entity, "binary")) return <Binary className="h-4 w-4" />
  return <Power className="h-4 w-4" />
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

  const statusBadge = (() => {
    if (!entity.available) {
      return (
        <Badge variant="danger" className="font-normal">
          {t("states.offline")}
        </Badge>
      )
    }
    if (sensor) return null
    if (hasCapability(entity, "on_off") || hasCapability(entity, "binary")) {
      return (
        <Badge
          variant="secondary"
          className={cn(
            "font-normal border-transparent",
            on ? "bg-primary/15 text-primary" : "bg-white/[0.06] text-muted-foreground",
          )}
        >
          {on ? t("states.on") : t("states.off")}
        </Badge>
      )
    }
    return null
  })()

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
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-2.5 pb-1.5 sm:p-3 sm:pb-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-muted-foreground backdrop-blur-md transition-colors duration-300",
              entity.available && on && "border-primary/20 bg-primary/10 text-primary",
              sensor && entity.available && "border-white/[0.08] bg-white/[0.06] text-foreground/80",
            )}
          >
            <DomainIcon entity={entity} />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{entity.name}</CardTitle>
            {statusBadge ? <div className="mt-1">{statusBadge}</div> : null}
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
      </CardHeader>

      <CardContent className="space-y-2.5 p-2.5 pt-0 sm:p-3 sm:pt-0">
        {sensor ? (
          <div className="iotvex-stat-value flex items-baseline gap-1.5 pt-0.5">
            <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {entity.state}
            </span>
            {unitOf(entity) ? (
              <span className="text-sm font-medium text-muted-foreground">{unitOf(entity)}</span>
            ) : null}
          </div>
        ) : null}

        {isLightStrip ? (
          <div className={cn("space-y-3 border-t border-white/[0.05] pt-2.5", !on && "opacity-50")}>
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
      </CardContent>
    </Card>
  )
}

type DeviceGroup = {
  key: string
  title: string
  entities: EntityState[]
}

function groupEntitiesByDevice(
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

export function EntityGrid({
  entities,
  devices = [],
  empty,
  className,
  onEdit,
}: {
  entities: EntityState[]
  devices?: Device[]
  empty?: ReactNode
  className?: string
  onEdit?: (entity: EntityState) => void
}) {
  const t = useTranslations("entity")
  const groups = useMemo(
    () => groupEntitiesByDevice(entities, devices, t("unboundDevice")),
    [entities, devices, t],
  )

  if (!entities.length) {
    return empty ?? <p className="text-sm text-muted-foreground">{t("emptyEntities")}</p>
  }

  return (
    <div className={cn("space-y-5", className)}>
      {groups.map((group, gi) => (
        <section
          key={group.key}
          className="iotvex-card-in space-y-2.5"
          style={{ animationDelay: `${gi * 55}ms` }}
        >
          <div className="iotvex-glass-muted flex items-center justify-between gap-3 rounded-2xl px-3 py-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
                {group.title}
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t("groupCount", { count: group.entities.length })}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-2.5">
            {group.entities.map((e, i) => (
              <EntityCard
                key={e.entity_id}
                entity={e}
                onEdit={onEdit}
                style={{ animationDelay: `${gi * 55 + i * 35}ms` }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
