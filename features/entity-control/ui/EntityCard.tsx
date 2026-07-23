"use client"

import { callEntity, smoothToggleEntity } from "@/entities/device/model/store"
import { hasCapability } from "@/entities/device/model/capabilities"
import type { EntityState } from "@/entities/device/model/types"
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
  Lightbulb,
  Pencil,
  Power,
  Thermometer,
  ToggleLeft,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"

function DomainIcon({ entity }: { entity: EntityState }) {
  if (entity.domain === "light") return <Lightbulb className="h-4 w-4" />
  if (entity.domain === "switch") return <ToggleLeft className="h-4 w-4" />
  if (hasCapability(entity, "temperature")) return <Thermometer className="h-4 w-4" />
  if (hasCapability(entity, "humidity")) return <Droplets className="h-4 w-4" />
  if (hasCapability(entity, "binary")) return <Binary className="h-4 w-4" />
  return <Power className="h-4 w-4" />
}

type StateLabels = { offline: string; on: string; off: string }

function stateLabel(entity: EntityState, labels: StateLabels) {
  if (!entity.available) return labels.offline
  if (hasCapability(entity, "on_off") || hasCapability(entity, "binary")) {
    const on = entity.state === "on" || entity.state === "home" || entity.state === "open"
    return on ? labels.on : labels.off
  }
  const unit = String(entity.attributes.unit_of_measurement || entity.attributes.unit || "")
  return unit ? `${entity.state} ${unit}` : entity.state
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
}: {
  entity: EntityState
  className?: string
  onEdit?: (entity: EntityState) => void
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
  const color = `rgb(${localRgb.join(",")})`
  const briPct = Math.round((localBri / 255) * 100)
  const fallbackEffect = t("fallbackEffect")
  const effects = useMemo(() => effectOptions(entity, fallbackEffect), [entity, fallbackEffect])
  const currentStateLabel = stateLabel(entity, {
    offline: t("states.offline"),
    on: t("states.on"),
    off: t("states.off"),
  })
  const isLightStrip =
    hasCapability(entity, "brightness") ||
    hasCapability(entity, "color") ||
    hasCapability(entity, "effect")

  useEffect(() => setLocalBri(brightness), [brightness])
  useEffect(() => setLocalSpeed(speed), [speed])
  useEffect(() => setLocalRgb(rgb), [rgb])

  let iconWrapStyle: CSSProperties | undefined
  let iconStyle: CSSProperties | undefined
  let cardGlowStyle: CSSProperties | undefined
  if (hasCapability(entity, "color") && on) {
    iconWrapStyle = { background: `${color}22` }
    iconStyle = { color }
    cardGlowStyle = {
      background: `linear-gradient(145deg, rgba(${localRgb.join(",")},0.12), transparent 52%)`,
    }
  }

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
    <Card className={cn("relative min-w-0 overflow-hidden", className)}>
      {cardGlowStyle ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={cardGlowStyle}
        />
      ) : null}
      <CardHeader className="relative flex flex-row items-start justify-between gap-2 space-y-0 p-2.5 pb-1.5 sm:p-3 sm:pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
            style={iconWrapStyle}
          >
            <span style={iconStyle}>
              <DomainIcon entity={entity} />
            </span>
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">{entity.name}</CardTitle>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
              <Badge
                variant={
                  entity.available
                    ? on || hasCapability(entity, "value")
                      ? "success"
                      : "secondary"
                    : "danger"
                }
              >
                {currentStateLabel}
              </Badge>
              <span className="truncate text-[11px] text-muted-foreground">
                {hasCapability(entity, "brightness") && on ? `${briPct}%` : entity.entity_id}
              </span>
            </div>
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

      <CardContent className="relative space-y-2 p-2.5 pt-0 sm:space-y-2.5 sm:p-3 sm:pt-0">
        {hasCapability(entity, "value") && !hasCapability(entity, "on_off") ? (
          <div className="text-xl font-semibold tracking-tight text-foreground">
            {entity.state}
            {entity.attributes.unit_of_measurement || entity.attributes.unit ? (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {String(entity.attributes.unit_of_measurement || entity.attributes.unit)}
              </span>
            ) : null}
          </div>
        ) : null}

        {isLightStrip ? (
          <div className={cn("space-y-2 sm:space-y-2.5", !on && "opacity-60")}>
            {hasCapability(entity, "brightness") ? (
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{t("brightness")}</span>
                  <span className="tabular-nums">{briPct}%</span>
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
              <div>
                <div className="mb-1 text-xs text-muted-foreground">{t("colorLabel")}</div>
                <ColorPicker
                  value={localRgb}
                  disabled={!entity.available || toggling}
                  onChange={setLocalRgb}
                  onCommit={commitColor}
                />
              </div>
            ) : null}

            {hasCapability(entity, "effect") || hasCapability(entity, "speed") ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {hasCapability(entity, "effect") ? (
                  <div className="min-w-0">
                    <div className="mb-1 text-xs text-muted-foreground">{t("effect")}</div>
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
                  <div className="min-w-0">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>{t("speed")}</span>
                      <span className="tabular-nums">{localSpeed}</span>
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

export function EntityGrid({
  entities,
  empty,
  className,
  onEdit,
}: {
  entities: EntityState[]
  empty?: ReactNode
  className?: string
  onEdit?: (entity: EntityState) => void
}) {
  const t = useTranslations("entity")
  if (!entities.length) {
    return empty ?? <p className="text-sm text-muted-foreground">{t("emptyEntities")}</p>
  }
  return (
    <div className={cn("grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-2.5", className)}>
      {entities.map((e) => (
        <EntityCard key={e.entity_id} entity={e} onEdit={onEdit} />
      ))}
    </div>
  )
}
