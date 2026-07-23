"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { Sun, Timer } from "lucide-react"

import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { FieldSelect, SegmentedTabs } from "@/shared/ui/page-toolbar"
import { Slider } from "@/shared/ui/slider"
import { ColorPicker, type Rgb } from "@/shared/ui/color-picker"
import { cn } from "@/shared/lib/utils"
import {
  byteToPct,
  effectSupportsColor,
  effectSupportsSpeed,
  isControllableEntity,
  isObservableEntity,
  pctToByte,
  sharedCapabilities,
  verbsForCapabilities,
} from "@/shared/lib/home/action-options"
import {
  stackItemOffsetClass,
  stackItemOffsetStyle,
  stackRadiusStyle,
} from "@/shared/lib/stack-radius"

export type RuleEntity = {
  id?: string
  entity_id?: string
  name?: string
  friendly_name?: string
  domain?: string
  capabilities?: string[]
  attributes?: Record<string, unknown>
}

export type AutomationAction = {
  entity_id?: string
  action?: string
  service?: string
  type?: string
  brightness?: number
  target?: { entity_id?: string | string[] }
  data?: Record<string, unknown>
}

export type AutomationItem = {
  id: string
  name: string
  enabled?: boolean
  description?: string
  trigger?: Record<string, unknown>
  conditions?: Array<Record<string, unknown>>
  actions?: AutomationAction[]
  trigger_label?: string
  action_label?: string
}

type TriggerKind = "time" | "state" | "numeric_state"
type ConditionKind = "state" | "numeric_state" | "time"

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

const EFFECT_FALLBACK = [
  "solid",
  "rainbow",
  "chase",
  "pulse",
  "sparkle",
  "theater",
  "fire",
  "comet",
  "wave",
  "scanner",
  "twinkle",
  "gradient",
  "color_loop",
  "snow",
]

function entityId(entity: RuleEntity): string {
  return entity.entity_id ?? entity.id ?? ""
}

function entityName(entity: RuleEntity): string {
  const friendlyName = entity.attributes?.friendly_name
  return (
    entity.name ??
    entity.friendly_name ??
    (typeof friendlyName === "string" ? friendlyName : undefined) ??
    entityId(entity)
  )
}

function capsOf(entity: RuleEntity | undefined): string[] {
  if (!entity) return []
  if (entity.capabilities?.length) return [...entity.capabilities]
  const domain = entity.domain || entityId(entity).split(".")[0]
  if (domain === "light") return ["on_off", "brightness", "color", "effect", "speed"]
  if (domain === "switch" || domain === "fan" || domain === "lock") return ["on_off"]
  if (domain === "climate") return ["on_off", "temperature"]
  if (domain === "sensor" || domain === "weather") return ["value"]
  if (domain === "binary_sensor") return ["binary"]
  return []
}

function collectTargetIds(actions: AutomationAction[] | undefined): string[] {
  const ids: string[] = []
  for (const action of actions || []) {
    const raw = action.target?.entity_id ?? action.entity_id
    if (Array.isArray(raw)) ids.push(...raw.map(String))
    else if (raw) ids.push(String(raw))
  }
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
}

function resolveEffectNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  const raw = String(value ?? "0").trim()
  const asNum = Number(raw)
  if (Number.isFinite(asNum)) return Math.trunc(asNum)
  const idx = EFFECT_FALLBACK.indexOf(raw.toLowerCase())
  return idx >= 0 ? idx : 0
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
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || requestError?.(response.status) || `Request error ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

type EffectOpt = { id: number; name: string }

type ConditionDraft = {
  id: string
  kind: ConditionKind
  entity_id: string
  state: string
  above: string
  below: string
  attribute: string
  after: string
  before: string
}

type TranslationFn = (key: string, values?: Record<string, number | string>) => string

function labelText(
  t: TranslationFn | undefined,
  key: string,
  fallback: string,
  values?: Record<string, number | string>,
): string {
  return t ? t(key, values) : fallback
}

function newCondition(entity_id = ""): ConditionDraft {
  return {
    id: Math.random().toString(36).slice(2, 9),
    kind: "state",
    entity_id,
    state: "on",
    above: "",
    below: "",
    attribute: "",
    after: "",
    before: "",
  }
}

function EditorSection({
  index,
  total,
  title,
  children,
  trailing,
}: {
  index: number
  total: number
  title: string
  children: ReactNode
  trailing?: ReactNode
}) {
  return (
    <section
      className={cn(
        "iotvex-surface grid gap-3 border border-border/60 bg-background/20 p-3",
        stackItemOffsetClass(index),
      )}
      style={{ ...stackItemOffsetStyle(index), ...stackRadiusStyle(index, total, "xl") }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        {trailing}
      </div>
      {children}
    </section>
  )
}

export function AutomationEditor({
  entities,
  item,
  open,
  onOpenChange,
  onSaved,
}: {
  entities: RuleEntity[]
  item: AutomationItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}) {
  const t = useTranslations("automationEditor")
  const tActions = useTranslations("actions")
  const common = useTranslations("common")
  const requestError = useCallback((status: number) => t("requestError", { status }), [t])
  const actionableEntities = useMemo(
    () => entities.filter((e) => isControllableEntity({ ...e, capabilities: capsOf(e) })),
    [entities],
  )
  const observableEntities = useMemo(
    () => entities.filter((e) => isObservableEntity({ ...e, capabilities: capsOf(e) })),
    [entities],
  )
  const actionableIds = useMemo(
    () => actionableEntities.map(entityId).filter(Boolean),
    [actionableEntities],
  )
  const firstActionableId = actionableIds[0] || ""
  const firstObservableId = entityId(observableEntities[0] ?? {}) || firstActionableId

  const [name, setName] = useState("")
  const [triggerKind, setTriggerKind] = useState<TriggerKind>("time")
  const [time, setTime] = useState("08:00")
  const [weekdays, setWeekdays] = useState<string[]>([])
  const [triggerEntity, setTriggerEntity] = useState(firstObservableId)
  const [triggerTo, setTriggerTo] = useState("on")
  const [triggerFrom, setTriggerFrom] = useState("")
  const [triggerAbove, setTriggerAbove] = useState("")
  const [triggerBelow, setTriggerBelow] = useState("")
  const [triggerAttribute, setTriggerAttribute] = useState("")
  const [conditions, setConditions] = useState<ConditionDraft[]>([])
  const [selectedEntities, setSelectedEntities] = useState<string[]>(
    actionableIds.length ? actionableIds : [],
  )
  const [verb, setVerb] = useState("turn_on")
  const [brightnessPct, setBrightnessPct] = useState(80)
  const [rgb, setRgb] = useState<Rgb>([255, 255, 255])
  const [effect, setEffect] = useState(0)
  const [speedPct, setSpeedPct] = useState(50)
  const [effects, setEffects] = useState<EffectOpt[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTargetEntities = useMemo(
    () =>
      selectedEntities
        .map((id) => actionableEntities.find((e) => entityId(e) === id))
        .filter((e): e is RuleEntity => Boolean(e)),
    [actionableEntities, selectedEntities],
  )
  const primaryEntity = selectedTargetEntities[0]
  const caps = useMemo(() => {
    if (!selectedTargetEntities.length) return [] as string[]
    // Prefer declared caps; fall back via capsOf then intersect across targets.
    return sharedCapabilities(
      selectedTargetEntities.map((e) => ({ ...e, capabilities: capsOf(e) })),
    )
  }, [selectedTargetEntities])
  const showColor =
    (verb === "turn_on" || verb === "set_color") &&
    caps.includes("color") &&
    effectSupportsColor(effect)
  const showSpeed =
    (verb === "turn_on" || verb === "set_effect" || verb === "set_speed") &&
    caps.includes("speed") &&
    effectSupportsSpeed(effect)
  const showBrightness =
    (verb === "turn_on" || verb === "set_brightness") && caps.includes("brightness")
  const showEffect =
    (verb === "turn_on" || verb === "set_effect") && caps.includes("effect")

  const verbOptions = useMemo(
    () =>
      verbsForCapabilities(caps, primaryEntity?.domain).map((option) => ({
        ...option,
        label: tActions(option.labelKey),
      })),
    [caps, primaryEntity?.domain, tActions],
  )

  useEffect(() => {
    if (!open) return
    void api<{ effects: EffectOpt[] }>("/api/iotvex/effects", undefined, requestError)
      .then((data) => setEffects(data.effects || []))
      .catch(() => setEffects([]))
  }, [open, requestError])

  useEffect(() => {
    if (!open) return
    const currentAction = item?.actions?.[0]
    const trigger = (item?.trigger || {}) as Record<string, unknown>
    const kind = String(trigger.trigger || trigger.platform || trigger.type || "time") as TriggerKind
    setName(item?.name ?? "")
    setTriggerKind(kind === "state" || kind === "numeric_state" ? kind : "time")
    setTime(String(trigger.at || trigger.time || "08:00").slice(0, 5))
    setWeekdays(Array.isArray(trigger.weekday) ? trigger.weekday.map(String) : [])
    setTriggerEntity(String(trigger.entity_id || firstObservableId))
    setTriggerTo(String(trigger.to ?? "on"))
    setTriggerFrom(String(trigger.from ?? ""))
    setTriggerAbove(trigger.above != null ? String(trigger.above) : "")
    setTriggerBelow(trigger.below != null ? String(trigger.below) : "")
    setTriggerAttribute(String(trigger.attribute || ""))

    const conds = Array.isArray(item?.conditions) ? item!.conditions! : []
    setConditions(
      conds.map((c) => {
        const row = c as Record<string, unknown>
        return {
          id: Math.random().toString(36).slice(2, 9),
          kind: (String(row.condition || "state") as ConditionKind) || "state",
          entity_id: String(row.entity_id || firstObservableId),
          state: String(row.state ?? "on"),
          above: row.above != null ? String(row.above) : "",
          below: row.below != null ? String(row.below) : "",
          attribute: String(row.attribute || ""),
          after: String(row.after || "").slice(0, 5),
          before: String(row.before || "").slice(0, 5),
        }
      }),
    )

    const targets = collectTargetIds(item?.actions).filter((id) => actionableIds.includes(id))
    if (targets.length) setSelectedEntities(targets)
    else if (actionableIds.length) setSelectedEntities(actionableIds)
    else setSelectedEntities([])

    const rawAction = String(
      currentAction?.action || currentAction?.service || currentAction?.type || "turn_on",
    )
    const normalized = rawAction.includes(".") ? rawAction.split(".").pop()! : rawAction
    setVerb(normalized)
    const data = (currentAction?.data || {}) as Record<string, unknown>
    const briPct =
      data.brightness_pct != null
        ? Number(data.brightness_pct)
        : data.brightness != null
          ? byteToPct(Number(data.brightness))
          : currentAction?.brightness != null
            ? Number(currentAction.brightness)
            : 80
    setBrightnessPct(Math.max(1, Math.min(100, Math.round(briPct))))
    const color = (data.rgb_color as number[]) || [255, 255, 255]
    setRgb([Number(color[0] ?? 255), Number(color[1] ?? 255), Number(color[2] ?? 255)])
    setEffect(resolveEffectNumber(data.effect ?? data.effect_id ?? 0))
    setSpeedPct(byteToPct(Number(data.speed ?? 128)))
    setError(null)
    // Only re-hydrate when the dialog opens or the edited automation changes —
    // never when live entity lists refresh (that was resetting the color picker).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  useEffect(() => {
    if (!verbOptions.some((o) => o.value === verb)) {
      setVerb(verbOptions[0]?.value || "turn_on")
    }
  }, [verb, verbOptions])

  const toggleDay = (day: string) => {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const toggleTarget = (id: string) => {
    if (!actionableIds.includes(id)) return
    setSelectedEntities((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }

  const selectAllTargets = () => {
    if (actionableIds.length) setSelectedEntities(actionableIds)
  }

  // Drop any non-controllable ids if the catalog refreshes while the dialog is open.
  useEffect(() => {
    setSelectedEntities((prev) => {
      const next = prev.filter((id) => actionableIds.includes(id))
      if (next.length === prev.length) return prev
      return next.length ? next : actionableIds.slice(0, 1)
    })
  }, [actionableIds])

  const buildTrigger = (): Record<string, unknown> => {
    if (triggerKind === "time") {
      const at = time.length === 5 ? `${time}:00` : time
      const row: Record<string, unknown> = { trigger: "time", at }
      if (weekdays.length) row.weekday = weekdays
      return row
    }
    if (triggerKind === "state") {
      const row: Record<string, unknown> = {
        trigger: "state",
        entity_id: triggerEntity,
        to: triggerTo,
      }
      if (triggerFrom) row.from = triggerFrom
      if (triggerAttribute) row.attribute = triggerAttribute
      return row
    }
    const row: Record<string, unknown> = {
      trigger: "numeric_state",
      entity_id: triggerEntity,
    }
    if (triggerAbove !== "") row.above = Number(triggerAbove)
    if (triggerBelow !== "") row.below = Number(triggerBelow)
    if (triggerAttribute) row.attribute = triggerAttribute
    return row
  }

  const buildConditions = () =>
    conditions.map((c) => {
      if (c.kind === "time") {
        const row: Record<string, unknown> = { condition: "time" }
        if (c.after) row.after = c.after.length === 5 ? `${c.after}:00` : c.after
        if (c.before) row.before = c.before.length === 5 ? `${c.before}:00` : c.before
        return row
      }
      if (c.kind === "numeric_state") {
        const row: Record<string, unknown> = {
          condition: "numeric_state",
          entity_id: c.entity_id,
        }
        if (c.above !== "") row.above = Number(c.above)
        if (c.below !== "") row.below = Number(c.below)
        if (c.attribute) row.attribute = c.attribute
        return row
      }
      const row: Record<string, unknown> = {
        condition: "state",
        entity_id: c.entity_id,
        state: c.state,
      }
      if (c.attribute) row.attribute = c.attribute
      return row
    })

  const buildActionData = (): Record<string, unknown> => {
    const data: Record<string, unknown> = {}
    if (showBrightness || verb === "set_brightness") {
      data.brightness_pct = brightnessPct
    }
    if (showColor || verb === "set_color") {
      data.rgb_color = rgb
    }
    if (showEffect || verb === "set_effect") {
      data.effect = effect
    }
    if (showSpeed || verb === "set_speed") {
      data.speed = pctToByte(speedPct)
    }
    return data
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      if (!selectedEntities.length) throw new Error(t("targetsRequired"))
      const domain = primaryEntity?.domain || selectedEntities[0]?.split(".")[0] || "home"
      const payload = {
        name: name.trim(),
        trigger: buildTrigger(),
        conditions: buildConditions(),
        actions: [
          {
            action: `${domain}.${verb}`,
            target: {
              entity_id:
                selectedEntities.length === 1 ? selectedEntities[0] : selectedEntities,
            },
            data: buildActionData(),
          },
        ],
      }
      await api(
        item ? `/api/automations/${item.id}` : "/api/automations",
        {
          method: item ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
        requestError,
      )
      onOpenChange(false)
      await onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("saveError"))
    } finally {
      setSaving(false)
    }
  }

  const triggerEntityOptions = observableEntities.map((entity) => ({
    value: entityId(entity),
    label: entityName(entity),
  }))
  const numericEntityOptions = observableEntities
    .filter((e) => {
      const caps = capsOf(e)
      return caps.includes("value") || caps.includes("temperature") || caps.includes("humidity")
    })
    .map((entity) => ({
      value: entityId(entity),
      label: entityName(entity),
    }))
  const conditionEntityOptions = triggerEntityOptions
  const targetHint =
    actionableEntities.length === 0
      ? t("noControllableTargets")
      : t("targetsHint", { count: selectedEntities.length })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? t("editTitle") : t("newTitle")}</DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[min(70dvh,640px)] gap-0 overflow-y-auto overscroll-contain py-1 [scrollbar-gutter:stable]">
          <div className="mb-4 grid gap-2">
            <Label htmlFor="automation-name">{t("nameLabel")}</Label>
            <Input
              id="automation-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("namePlaceholder")}
            />
          </div>

          <EditorSection index={0} total={3} title={t("triggerSection")}>
            <SegmentedTabs
              value={triggerKind}
              onValueChange={(v) => setTriggerKind(v as TriggerKind)}
              items={[
                { value: "time", label: t("triggerKinds.time") },
                { value: "state", label: t("triggerKinds.state") },
                { value: "numeric_state", label: t("triggerKinds.numeric_state") },
              ]}
            />

            {triggerKind === "time" ? (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="automation-time">{t("timeLabel")}</Label>
                  <Input
                    id="automation-time"
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    className="h-10 max-h-10"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("weekdaysLabel")}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((d) => {
                      const active = weekdays.includes(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(d)}
                          className={
                            active
                              ? "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-primary/40 bg-primary/12 px-2.5 text-xs font-medium text-primary"
                              : "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-border/70 px-2.5 text-xs text-muted-foreground"
                          }
                        >
                          {t(`weekdays.${d}`)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {triggerKind === "state" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldSelect
                  label={t("entityLabel")}
                  value={triggerEntity}
                  onValueChange={setTriggerEntity}
                  options={conditionEntityOptions}
                />
                <div className="grid gap-2">
                  <Label>{t("becomesLabel")}</Label>
                  <Input value={triggerTo} onChange={(e) => setTriggerTo(e.target.value)} placeholder="on" />
                </div>
                <div className="grid gap-2">
                  <Label>{t("wasOptionalLabel")}</Label>
                  <Input value={triggerFrom} onChange={(e) => setTriggerFrom(e.target.value)} placeholder="off" />
                </div>
                <div className="grid gap-2">
                  <Label>{t("attributeOptionalLabel")}</Label>
                  <Input
                    value={triggerAttribute}
                    onChange={(e) => setTriggerAttribute(e.target.value)}
                    placeholder={t("attributePlaceholder")}
                  />
                </div>
              </div>
            ) : null}

            {triggerKind === "numeric_state" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldSelect
                  label={t("entityLabel")}
                  value={triggerEntity}
                  onValueChange={setTriggerEntity}
                  options={numericEntityOptions.length ? numericEntityOptions : triggerEntityOptions}
                />
                <div className="grid gap-2">
                  <Label>{t("attributeLabel")}</Label>
                  <Input
                    value={triggerAttribute}
                    onChange={(e) => setTriggerAttribute(e.target.value)}
                    placeholder={t("numericAttributePlaceholder")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("aboveLabel")}</Label>
                  <Input
                    type="number"
                    value={triggerAbove}
                    onChange={(e) => setTriggerAbove(e.target.value)}
                    placeholder={t("abovePlaceholder")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("belowLabel")}</Label>
                  <Input
                    type="number"
                    value={triggerBelow}
                    onChange={(e) => setTriggerBelow(e.target.value)}
                    placeholder={t("belowPlaceholder")}
                  />
                </div>
              </div>
            ) : null}
          </EditorSection>

          <EditorSection
            index={1}
            total={3}
            title={t("conditionsSection")}
            trailing={
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setConditions((c) => [...c, newCondition(firstObservableId)])}
              >
                {t("addCondition")}
              </Button>
            }
          >
            {conditions.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noConditions")}</p>
            ) : null}
            {conditions.map((c, index) => (
              <div key={c.id} className="grid gap-2 rounded-lg border border-border/50 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <FieldSelect
                    label={t("conditionLabel", { index: index + 1 })}
                    value={c.kind}
                    onValueChange={(v) =>
                      setConditions((list) =>
                        list.map((row) =>
                          row.id === c.id ? { ...row, kind: v as ConditionKind } : row,
                        ),
                      )
                    }
                    options={[
                      { value: "state", label: t("conditionKinds.state") },
                      { value: "numeric_state", label: t("conditionKinds.numeric_state") },
                      { value: "time", label: t("conditionKinds.time") },
                    ]}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="mt-6"
                    onClick={() => setConditions((list) => list.filter((row) => row.id !== c.id))}
                  >
                    {common("delete")}
                  </Button>
                </div>
                {c.kind !== "time" ? (
                  <FieldSelect
                    label={t("entityLabel")}
                    value={c.entity_id}
                    onValueChange={(v) =>
                      setConditions((list) =>
                        list.map((row) => (row.id === c.id ? { ...row, entity_id: v } : row)),
                      )
                    }
                    options={conditionEntityOptions}
                  />
                ) : null}
                {c.kind === "state" ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>{t("equalsLabel")}</Label>
                      <Input
                        value={c.state}
                        onChange={(e) =>
                          setConditions((list) =>
                            list.map((row) =>
                              row.id === c.id ? { ...row, state: e.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("attributeLabel")}</Label>
                      <Input
                        value={c.attribute}
                        onChange={(e) =>
                          setConditions((list) =>
                            list.map((row) =>
                              row.id === c.id ? { ...row, attribute: e.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                ) : null}
                {c.kind === "numeric_state" ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="grid gap-2">
                      <Label>{t("attributeLabel")}</Label>
                      <Input
                        value={c.attribute}
                        onChange={(e) =>
                          setConditions((list) =>
                            list.map((row) =>
                              row.id === c.id ? { ...row, attribute: e.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("aboveLabel")}</Label>
                      <Input
                        type="number"
                        value={c.above}
                        onChange={(e) =>
                          setConditions((list) =>
                            list.map((row) =>
                              row.id === c.id ? { ...row, above: e.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("belowLabel")}</Label>
                      <Input
                        type="number"
                        value={c.below}
                        onChange={(e) =>
                          setConditions((list) =>
                            list.map((row) =>
                              row.id === c.id ? { ...row, below: e.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                ) : null}
                {c.kind === "time" ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>{t("afterLabel")}</Label>
                      <Input
                        type="time"
                        className="h-10 max-h-10"
                        value={c.after}
                        onChange={(e) =>
                          setConditions((list) =>
                            list.map((row) =>
                              row.id === c.id ? { ...row, after: e.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t("beforeLabel")}</Label>
                      <Input
                        type="time"
                        className="h-10 max-h-10"
                        value={c.before}
                        onChange={(e) =>
                          setConditions((list) =>
                            list.map((row) =>
                              row.id === c.id ? { ...row, before: e.target.value } : row,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </EditorSection>

          <EditorSection index={2} total={3} title={t("actionSection")}>
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>{t("targetsLabel")}</Label>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={selectAllTargets}>
                  {t("selectAllTargets")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {actionableEntities.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("noControllableTargets")}</p>
                ) : (
                  actionableEntities.map((entity) => {
                    const id = entityId(entity)
                    if (!id) return null
                    const active = selectedEntities.includes(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleTarget(id)}
                        className={cn(
                          "inline-flex min-h-9 items-center rounded-lg border px-2.5 text-xs font-medium transition",
                          active
                            ? "border-primary/40 bg-primary/12 text-primary"
                            : "border-border/70 text-muted-foreground hover:bg-accent/40",
                        )}
                      >
                        {entityName(entity)}
                      </button>
                    )
                  })
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{targetHint}</p>
            </div>

            <FieldSelect
              label={t("commandLabel")}
              value={verb}
              onValueChange={setVerb}
              options={verbOptions.map((o) => ({ value: o.value, label: o.label }))}
            />

            {showBrightness || showSpeed ? (
              <div
                className={cn(
                  "grid gap-2.5",
                  showBrightness && showSpeed ? "grid-cols-2" : "grid-cols-1",
                )}
              >
                {showBrightness ? (
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Sun className="h-3.5 w-3.5" />
                      <span>{t("brightnessLabel")}</span>
                      <span className="ml-auto tabular-nums text-foreground/80">{brightnessPct}%</span>
                    </div>
                    <Slider
                      aria-label={t("brightnessLabel")}
                      min={1}
                      max={100}
                      step={1}
                      value={[brightnessPct]}
                      onValueChange={(v) => setBrightnessPct(v[0])}
                    />
                  </div>
                ) : null}
                {showSpeed ? (
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Timer className="h-3.5 w-3.5" />
                      <span>{t("speedLabel")}</span>
                      <span className="ml-auto tabular-nums text-foreground/80">{speedPct}%</span>
                    </div>
                    <Slider
                      aria-label={t("speedLabel")}
                      min={1}
                      max={100}
                      step={1}
                      value={[speedPct]}
                      onValueChange={(v) => setSpeedPct(v[0])}
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
                    <ColorPicker value={rgb} onChange={setRgb} onCommit={setRgb} />
                  </div>
                ) : null}
                {showEffect ? (
                  <div className="min-w-0 space-y-1.5">
                    <FieldSelect
                      label={t("effectLabel")}
                      value={String(effect)}
                      onValueChange={(v) => setEffect(Number(v))}
                      options={(effects.length
                        ? effects
                        : EFFECT_FALLBACK.map((name, id) => ({ id, name }))
                      ).map((e) => ({ value: String(e.id), label: e.name }))}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </EditorSection>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {common("cancel")}
          </Button>
          <Button
            onClick={() => void save()}
            disabled={saving || !name.trim() || selectedEntities.length === 0}
          >
            {saving ? common("saving") : common("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function triggerLabel(item: AutomationItem, t?: TranslationFn): string {
  const trigger = item.trigger || {}
  const kind = String(trigger.trigger || trigger.platform || trigger.type || "")
  if (kind === "time" || trigger.at || trigger.time) {
    const at = String(trigger.at || trigger.time || "")
    const time = String(at).slice(0, 5)
    const days = Array.isArray(trigger.weekday) ? ` (${(trigger.weekday as string[]).join(",")})` : ""
    return at
      ? labelText(t, "triggerLabels.timeAt", `Time ${time}${days}`, { time, days })
      : labelText(t, "triggerLabels.timeFallback", "Time trigger")
  }
  if (kind === "state") {
    const entity = String(trigger.entity_id || "?")
    const to = String(trigger.to ?? "*")
    return labelText(t, "triggerLabels.state", `State ${entity} -> ${to}`, { entity, to })
  }
  if (kind === "numeric_state") {
    const bits = []
    if (trigger.above != null) bits.push(`>${trigger.above}`)
    if (trigger.below != null) bits.push(`<${trigger.below}`)
    const entity = String(trigger.entity_id || "?")
    const range = bits.join(" ")
    return labelText(t, "triggerLabels.numeric", `Number ${entity} ${range}`, {
      entity,
      range,
    }).trim()
  }
  return item.trigger_label || labelText(t, "triggerLabels.undefined", "Start condition is not set")
}

export function actionLabel(item: { actions?: AutomationAction[] }, t?: TranslationFn): string {
  const actions = item.actions || []
  const action = actions[0]
  if (!action) return labelText(t, "actionLabels.undefined", "Action is not set")
  const kind = String(
    action.action ||
      action.service ||
      action.type ||
      labelText(t, "actionLabels.fallbackAction", "action"),
  )
  const targets = collectTargetIds(actions)
  if (targets.length > 1) {
    return labelText(t, "actionLabels.multi", `${kind} → ${targets.length} targets`, {
      kind,
      count: targets.length,
    })
  }
  const eid =
    targets[0] ||
    labelText(t, "actionLabels.fallbackTarget", "entity")
  return `${kind} → ${eid}`
}
