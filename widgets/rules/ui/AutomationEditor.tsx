"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"

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
import { verbsForCapabilities } from "@/shared/lib/home/action-options"

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

const COLOR_PRESETS = [
  [255, 255, 255],
  [255, 180, 120],
  [255, 110, 84],
  [255, 64, 64],
  [255, 40, 160],
  [80, 120, 255],
  [40, 200, 180],
  [120, 255, 80],
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
  if (!entity) return ["on_off"]
  if (entity.capabilities?.length) return entity.capabilities
  const domain = entity.domain || entityId(entity).split(".")[0]
  if (domain === "light") return ["on_off", "brightness", "color", "effect", "speed"]
  if (domain === "switch") return ["on_off"]
  return ["on_off"]
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
  const firstEntityId = entityId(entities[0] ?? {})
  const [name, setName] = useState("")
  const [triggerKind, setTriggerKind] = useState<TriggerKind>("time")
  const [time, setTime] = useState("08:00")
  const [weekdays, setWeekdays] = useState<string[]>([])
  const [triggerEntity, setTriggerEntity] = useState(firstEntityId)
  const [triggerTo, setTriggerTo] = useState("on")
  const [triggerFrom, setTriggerFrom] = useState("")
  const [triggerAbove, setTriggerAbove] = useState("")
  const [triggerBelow, setTriggerBelow] = useState("")
  const [triggerAttribute, setTriggerAttribute] = useState("")
  const [conditions, setConditions] = useState<ConditionDraft[]>([])
  const [selectedEntity, setSelectedEntity] = useState(firstEntityId)
  const [verb, setVerb] = useState("turn_on")
  const [brightness, setBrightness] = useState(80)
  const [rgb, setRgb] = useState<[number, number, number]>([255, 255, 255])
  const [effect, setEffect] = useState(0)
  const [speed, setSpeed] = useState(128)
  const [effects, setEffects] = useState<EffectOpt[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(
    () => entities.find((e) => entityId(e) === selectedEntity),
    [entities, selectedEntity],
  )
  const caps = capsOf(selected)
  const verbOptions = useMemo(
    () =>
      verbsForCapabilities(caps, selected?.domain).map((option) => ({
        ...option,
        label: tActions(option.labelKey),
      })),
    [caps, selected?.domain, tActions],
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
    setTriggerEntity(String(trigger.entity_id || firstEntityId))
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
          entity_id: String(row.entity_id || firstEntityId),
          state: String(row.state ?? "on"),
          above: row.above != null ? String(row.above) : "",
          below: row.below != null ? String(row.below) : "",
          attribute: String(row.attribute || ""),
          after: String(row.after || "").slice(0, 5),
          before: String(row.before || "").slice(0, 5),
        }
      }),
    )

    const target = (currentAction?.target || {}) as { entity_id?: string }
    const eid = String(target.entity_id || currentAction?.entity_id || firstEntityId)
    setSelectedEntity(eid)
    const rawAction = String(currentAction?.action || currentAction?.service || currentAction?.type || "turn_on")
    const normalized = rawAction.includes(".") ? rawAction.split(".").pop()! : rawAction
    setVerb(normalized)
    const data = (currentAction?.data || {}) as Record<string, unknown>
    setBrightness(Number(data.brightness_pct ?? currentAction?.brightness ?? 80))
    const color = (data.rgb_color as number[]) || [255, 255, 255]
    setRgb([Number(color[0] ?? 255), Number(color[1] ?? 255), Number(color[2] ?? 255)])
    setEffect(Number(data.effect ?? data.effect_id ?? 0))
    setSpeed(Number(data.speed ?? 128))
    setError(null)
  }, [firstEntityId, item, open])

  useEffect(() => {
    if (!verbOptions.some((o) => o.value === verb)) {
      setVerb(verbOptions[0]?.value || "turn_on")
    }
  }, [verb, verbOptions])

  const toggleDay = (day: string) => {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const buildTrigger = (): Record<string, unknown> => {
    if (triggerKind === "time") {
      const at = time.length === 5 ? `${time}:00` : time
      const t: Record<string, unknown> = { trigger: "time", at }
      if (weekdays.length) t.weekday = weekdays
      return t
    }
    if (triggerKind === "state") {
      const t: Record<string, unknown> = {
        trigger: "state",
        entity_id: triggerEntity,
        to: triggerTo,
      }
      if (triggerFrom) t.from = triggerFrom
      if (triggerAttribute) t.attribute = triggerAttribute
      return t
    }
    const t: Record<string, unknown> = {
      trigger: "numeric_state",
      entity_id: triggerEntity,
    }
    if (triggerAbove !== "") t.above = Number(triggerAbove)
    if (triggerBelow !== "") t.below = Number(triggerBelow)
    if (triggerAttribute) t.attribute = triggerAttribute
    return t
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
    if (verb === "turn_on" || verb === "set_brightness") {
      if (caps.includes("brightness")) data.brightness_pct = brightness
    }
    if ((verb === "turn_on" || verb === "set_color") && caps.includes("color")) {
      data.rgb_color = rgb
    }
    if ((verb === "turn_on" || verb === "set_effect") && caps.includes("effect")) {
      data.effect = effect
    }
    if ((verb === "turn_on" || verb === "set_speed" || verb === "set_effect") && caps.includes("speed")) {
      data.speed = speed
    }
    if (verb === "set_color") data.rgb_color = rgb
    if (verb === "set_effect") data.effect = effect
    if (verb === "set_speed") data.speed = speed
    return data
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const domain = selected?.domain || selectedEntity.split(".")[0] || "home"
      const payload = {
        name: name.trim(),
        trigger: buildTrigger(),
        conditions: buildConditions(),
        actions: [
          {
            action: `${domain}.${verb}`,
            target: { entity_id: selectedEntity },
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

  const entityOptions = entities.map((entity) => ({
    value: entityId(entity),
    label: entityName(entity),
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {item ? t("editTitle") : t("newTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid max-h-[min(70dvh,640px)] gap-4 overflow-y-auto overscroll-contain py-1 [scrollbar-gutter:stable]">
          <div className="grid gap-2">
            <Label htmlFor="automation-name">{t("nameLabel")}</Label>
            <Input
              id="automation-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("namePlaceholder")}
            />
          </div>

          <section className="grid gap-3 rounded-xl border border-border/60 bg-background/20 p-3">
            <div className="text-sm font-medium">{t("triggerSection")}</div>
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
                  options={entityOptions}
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
                  options={entityOptions}
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
          </section>

          <section className="grid gap-3 rounded-xl border border-border/60 bg-background/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">{t("conditionsSection")}</div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setConditions((c) => [...c, newCondition(firstEntityId)])}
              >
                {t("addCondition")}
              </Button>
            </div>
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
                    options={entityOptions}
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
          </section>

          <section className="grid gap-3 rounded-xl border border-border/60 bg-background/20 p-3">
            <div className="text-sm font-medium">{t("actionSection")}</div>
            <FieldSelect
              label={t("entityLabel")}
              value={selectedEntity}
              onValueChange={setSelectedEntity}
              options={entityOptions}
            />
            <FieldSelect
              label={t("commandLabel")}
              value={verb}
              onValueChange={setVerb}
              options={verbOptions.map((o) => ({ value: o.value, label: o.label }))}
            />

            {(verb === "turn_on" || verb === "set_brightness") && caps.includes("brightness") ? (
              <div className="grid gap-2">
                <Label htmlFor="automation-brightness">{t("brightnessLabel")}</Label>
                <Input
                  id="automation-brightness"
                  type="number"
                  min={1}
                  max={100}
                  value={brightness}
                  onChange={(event) => setBrightness(Number(event.target.value))}
                />
              </div>
            ) : null}

            {(verb === "turn_on" || verb === "set_color") && caps.includes("color") ? (
              <div className="grid gap-2">
                <Label>{t("colorLabel")}</Label>
                <div className="grid grid-cols-8 gap-1.5">
                  {COLOR_PRESETS.map((p) => {
                    const active = rgb[0] === p[0] && rgb[1] === p[1] && rgb[2] === p[2]
                    return (
                      <button
                        key={p.join("-")}
                        type="button"
                        className={
                          active
                            ? "h-7 rounded-full border border-primary ring-1 ring-primary/40"
                            : "h-7 rounded-full border border-border/80"
                        }
                        style={{ background: `rgb(${p.join(",")})` }}
                        onClick={() => setRgb([p[0], p[1], p[2]])}
                      />
                    )
                  })}
                </div>
              </div>
            ) : null}

            {(verb === "turn_on" || verb === "set_effect") && caps.includes("effect") ? (
              <FieldSelect
                label={t("effectLabel")}
                value={String(effect)}
                onValueChange={(v) => setEffect(Number(v))}
                options={(effects.length
                  ? effects
                  : [{ id: 0, name: "solid" }]
                ).map((e) => ({ value: String(e.id), label: e.name }))}
              />
            ) : null}

            {(verb === "turn_on" || verb === "set_effect" || verb === "set_speed") &&
            caps.includes("speed") ? (
              <div className="grid gap-2">
                <Label htmlFor="automation-speed">{t("speedLabel")}</Label>
                <Input
                  id="automation-speed"
                  type="number"
                  min={0}
                  max={255}
                  value={speed}
                  onChange={(event) => setSpeed(Number(event.target.value))}
                />
              </div>
            ) : null}

            {selected ? (
              <p className="text-[11px] text-muted-foreground">
                {t("capabilitiesLine", {
                  capabilities: caps.join(", ") || t("emptyCapabilities"),
                  domain: selected.domain || t("unknownDomain"),
                })}
              </p>
            ) : null}
          </section>

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
  const action = item.actions?.[0]
  if (!action) return labelText(t, "actionLabels.undefined", "Action is not set")
  const kind = String(
    action.action ||
      action.service ||
      action.type ||
      labelText(t, "actionLabels.fallbackAction", "action"),
  )
  const target = (action.target || {}) as { entity_id?: string }
  const eid = target.entity_id || action.entity_id || labelText(t, "actionLabels.fallbackTarget", "entity")
  return `${kind} -> ${eid}`
}
