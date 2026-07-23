"use client"

import { cn } from "@/shared/lib/utils"
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
import { Slider } from "@/shared/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { hsvToRgb, rgbToHsv, type Rgb } from "@/shared/ui/color-math"

const PRESETS_KEY = "iotvex-color-presets"

const DEFAULT_PRESETS: Rgb[] = [
  [255, 255, 255],
  [255, 180, 120],
  [255, 110, 84],
  [255, 64, 64],
  [255, 40, 160],
  [80, 120, 255],
  [40, 200, 180],
  [120, 255, 80],
]

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function clampByte(n: number) {
  return clamp(Math.round(n), 0, 255)
}

function rgbEqual(a: Rgb, b: Rgb) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

function rgbToHex(rgb: Rgb) {
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`
}

function hexToRgb(hex: string): Rgb | null {
  const raw = hex.trim().replace(/^#/, "")
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null
  return [
    parseInt(raw.slice(0, 2), 16),
    parseInt(raw.slice(2, 4), 16),
    parseInt(raw.slice(4, 6), 16),
  ]
}

function loadPresets(): Rgb[] {
  if (typeof window === "undefined") return DEFAULT_PRESETS
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    if (!raw) return DEFAULT_PRESETS
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_PRESETS
    const next = parsed
      .map((item) => {
        if (!Array.isArray(item) || item.length < 3) return null
        return [clampByte(Number(item[0])), clampByte(Number(item[1])), clampByte(Number(item[2]))] as Rgb
      })
      .filter((item): item is Rgb => item != null)
    return next.length ? next.slice(0, 24) : DEFAULT_PRESETS
  } catch {
    return DEFAULT_PRESETS
  }
}

function savePresets(presets: Rgb[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets.slice(0, 24)))
}

function SvSquare({
  hue,
  sat,
  val,
  disabled,
  onChange,
  onCommit,
}: {
  hue: number
  sat: number
  val: number
  disabled?: boolean
  onChange: (sat: number, val: number) => void
  onCommit: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const applyPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = clamp((clientX - rect.left) / rect.width, 0, 1)
      const y = clamp((clientY - rect.top) / rect.height, 0, 1)
      onChange(x, 1 - y)
    },
    [onChange],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    applyPoint(e.clientX, e.clientY)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || disabled) return
    applyPoint(e.clientX, e.clientY)
  }

  const endDrag = () => {
    if (!dragging.current) return
    dragging.current = false
    onCommit()
  }

  return (
    <div
      ref={ref}
      role="presentation"
      className={cn(
        "relative aspect-[1.35] w-full cursor-crosshair touch-none overflow-hidden rounded-lg border border-border/70",
        disabled && "pointer-events-none opacity-50",
      )}
      style={{
        backgroundColor: `hsl(${hue} 100% 50%)`,
        backgroundImage:
          "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
        style={{ left: `${sat * 100}%`, top: `${(1 - val) * 100}%` }}
      />
    </div>
  )
}

export function ColorPickerDialog({
  open,
  onOpenChange,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: Rgb
  disabled?: boolean
  onChange?: (rgb: Rgb) => void
  onCommit: (rgb: Rgb) => void
}) {
  const t = useTranslations("entity.colorPicker")
  const [h0, s0, v0] = useMemo(() => rgbToHsv(value[0], value[1], value[2]), [value])
  const [hue, setHue] = useState(h0)
  const [sat, setSat] = useState(s0)
  const [val, setVal] = useState(Math.max(v0, 0.01))
  const [hexText, setHexText] = useState(rgbToHex(value))
  const [presets, setPresets] = useState<Rgb[]>(DEFAULT_PRESETS)
  const hsvRef = useRef({ hue, sat, val })
  hsvRef.current = { hue, sat, val }

  useEffect(() => {
    if (!open) return
    // Init only when the dialog opens — never while the user is picking a color.
    const [h, s, v] = rgbToHsv(value[0], value[1], value[2])
    setHue(h)
    setSat(s)
    setVal(Math.max(v, 0.01))
    setHexText(rgbToHex(value))
    setPresets(loadPresets())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally seed once per open
  }, [open])

  const live = useMemo(() => hsvToRgb(hue, sat, val), [hue, sat, val])
  const preview = `rgb(${live.join(",")})`

  useEffect(() => {
    setHexText(rgbToHex(live))
  }, [live])

  const paint = (nextH: number, nextS: number, nextV: number) => {
    onChange?.(hsvToRgb(nextH, nextS, nextV))
  }

  const commitLive = () => {
    const { hue: hh, sat: ss, val: vv } = hsvRef.current
    onCommit(hsvToRgb(hh, ss, vv))
  }

  const applyRgb = (next: Rgb, commit = true) => {
    const [nh, ns, nv] = rgbToHsv(next[0], next[1], next[2])
    setHue(nh)
    setSat(ns)
    setVal(Math.max(nv, 0.01))
    onChange?.(next)
    if (commit) onCommit(next)
  }

  const updatePresets = (next: Rgb[]) => {
    setPresets(next)
    savePresets(next)
  }

  const saveCurrentPreset = () => {
    if (presets.some((p) => rgbEqual(p, live))) return
    updatePresets([...presets, live].slice(0, 24))
  }

  const movePreset = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= presets.length) return
    const next = presets.slice()
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    updatePresets(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-3 p-3.5 sm:p-4">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 shrink-0 rounded-lg border border-border/70 shadow-inner"
            style={{ background: preview }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm tabular-nums">{rgbToHex(live)}</p>
            <p className="text-xs text-muted-foreground">
              RGB {live[0]}, {live[1]}, {live[2]}
            </p>
          </div>
        </div>

        <Tabs defaultValue="wheel" className="min-w-0">
          <TabsList className="h-auto w-full">
            <TabsTrigger value="wheel" className="flex-1 px-2 text-[11px] sm:text-xs">
              {t("tabs.wheel")}
            </TabsTrigger>
            <TabsTrigger value="sliders" className="flex-1 px-2 text-[11px] sm:text-xs">
              {t("tabs.sliders")}
            </TabsTrigger>
            <TabsTrigger value="hex" className="flex-1 px-2 text-[11px] sm:text-xs">
              {t("tabs.hex")}
            </TabsTrigger>
            <TabsTrigger value="presets" className="flex-1 px-2 text-[11px] sm:text-xs">
              {t("tabs.presets")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wheel" className="mt-3 space-y-2.5">
            <SvSquare
              hue={hue}
              sat={sat}
              val={val}
              disabled={disabled}
              onChange={(nextS, nextV) => {
                setSat(nextS)
                setVal(nextV)
                paint(hue, nextS, nextV)
              }}
              onCommit={commitLive}
            />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("hue")}</Label>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                disabled={disabled}
                value={Math.round(hue)}
                aria-label={t("hue")}
                className="iotvex-hue-range h-2.5 w-full cursor-pointer appearance-none rounded-full disabled:opacity-50"
                onChange={(e) => {
                  const next = Number(e.target.value)
                  setHue(next)
                  paint(next, sat, val)
                }}
                onPointerUp={commitLive}
                onBlur={commitLive}
              />
            </div>
          </TabsContent>

          <TabsContent value="sliders" className="mt-3 space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("hue")}</span>
                <span className="tabular-nums">{Math.round(hue)}°</span>
              </div>
              <Slider
                min={0}
                max={360}
                step={1}
                disabled={disabled}
                value={[Math.round(hue)]}
                onValueChange={(v) => {
                  setHue(v[0])
                  paint(v[0], sat, val)
                }}
                onValueCommit={commitLive}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("saturation")}</span>
                <span className="tabular-nums">{Math.round(sat * 100)}%</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                disabled={disabled}
                value={[Math.round(sat * 100)]}
                onValueChange={(v) => {
                  const next = v[0] / 100
                  setSat(next)
                  paint(hue, next, val)
                }}
                onValueCommit={commitLive}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("value")}</span>
                <span className="tabular-nums">{Math.round(val * 100)}%</span>
              </div>
              <Slider
                min={1}
                max={100}
                step={1}
                disabled={disabled}
                value={[Math.round(val * 100)]}
                onValueChange={(v) => {
                  const next = v[0] / 100
                  setVal(next)
                  paint(hue, sat, next)
                }}
                onValueCommit={commitLive}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(["r", "g", "b"] as const).map((channel, idx) => (
                <div key={channel} className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">{channel}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={255}
                    disabled={disabled}
                    value={live[idx]}
                    className="h-9"
                    onChange={(e) => {
                      const next = live.slice() as Rgb
                      next[idx] = clampByte(Number(e.target.value) || 0)
                      applyRgb(next, false)
                    }}
                    onBlur={commitLive}
                  />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="hex" className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("hex")}</Label>
              <Input
                value={hexText}
                disabled={disabled}
                className="font-mono uppercase"
                spellCheck={false}
                onChange={(e) => {
                  const text = e.target.value
                  setHexText(text)
                  const parsed = hexToRgb(text)
                  if (parsed) applyRgb(parsed, false)
                }}
                onBlur={() => {
                  const parsed = hexToRgb(hexText)
                  if (parsed) {
                    applyRgb(parsed, true)
                    setHexText(rgbToHex(parsed))
                  } else {
                    setHexText(rgbToHex(live))
                    commitLive()
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["r", "g", "b"] as const).map((channel, idx) => (
                <div key={channel} className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">{channel}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={255}
                    disabled={disabled}
                    value={live[idx]}
                    className="h-9"
                    onChange={(e) => {
                      const next = live.slice() as Rgb
                      next[idx] = clampByte(Number(e.target.value) || 0)
                      applyRgb(next, false)
                    }}
                    onBlur={commitLive}
                  />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="presets" className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{t("quickAccess")}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={disabled || presets.some((p) => rgbEqual(p, live))}
                  onClick={saveCurrentPreset}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("saveCurrent")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => {
                  const active = rgbEqual(live, p)
                  return (
                    <button
                      key={p.join("-")}
                      type="button"
                      disabled={disabled}
                      className={cn(
                        "h-7 w-7 rounded-md border transition active:scale-95 disabled:opacity-50",
                        active ? "border-foreground/70 ring-1 ring-foreground/25" : "border-border/80",
                      )}
                      style={{ background: `rgb(${p.join(",")})` }}
                      onClick={() => applyRgb(p)}
                      aria-label={rgbToHex(p)}
                    />
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{t("managePresets")}</p>
              <div className="max-h-44 space-y-1 overflow-y-auto overscroll-contain rounded-lg border border-border/60 p-1">
                {presets.map((p, index) => (
                  <div
                    key={`${p.join("-")}-${index}`}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50"
                  >
                    <span
                      className="h-5 w-5 shrink-0 rounded border border-border/70"
                      style={{ background: `rgb(${p.join(",")})` }}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs tabular-nums">
                      {rgbToHex(p)}
                    </span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={index === 0}
                      aria-label={t("moveUp")}
                      onClick={() => movePreset(index, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={index === presets.length - 1}
                      aria-label={t("moveDown")}
                      onClick={() => movePreset(index, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label={t("remove")}
                      onClick={() => updatePresets(presets.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {!presets.length ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">{t("noPresets")}</p>
                ) : null}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">{t("quickAccess")}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {presets.slice(0, 10).map((p) => {
              const active = rgbEqual(live, p)
              return (
                <button
                  key={`quick-${p.join("-")}`}
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "h-6 w-6 rounded-md border transition active:scale-95 disabled:opacity-50",
                    active ? "border-foreground/70 ring-1 ring-foreground/25" : "border-border/80",
                  )}
                  style={{ background: `rgb(${p.join(",")})` }}
                  onClick={() => applyRgb(p)}
                />
              )
            })}
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              disabled={disabled || presets.some((p) => rgbEqual(p, live))}
              aria-label={t("saveCurrent")}
              onClick={saveCurrentPreset}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
