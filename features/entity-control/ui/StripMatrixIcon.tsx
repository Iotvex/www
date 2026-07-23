"use client"

import { cn } from "@/shared/lib/utils"
import type { EntityState } from "@/entities/device/model/types"
import { useEffect, useRef } from "react"

type Rgb = [number, number, number]

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
] as const

/** Virtual strip length — spatial effects sample onto the 3×3 preview. */
const VIRTUAL_LEDS = 30

/**
 * Per-cell radii matching the outer rounded-lg frame:
 * only the outer corner of corner cells is rounded; edges/center stay sharp.
 */
function cellRadii(col: number, row: number, r: number): [number, number, number, number] {
  // order: TL, TR, BR, BL
  return [
    col === 0 && row === 0 ? r : 0,
    col === 2 && row === 0 ? r : 0,
    col === 2 && row === 2 ? r : 0,
    col === 0 && row === 2 ? r : 0,
  ]
}

function effectNameOf(entity: EntityState): string {
  const list = entity.attributes.effect_list
  const effect = Number(entity.attributes.effect ?? 0)
  if (Array.isArray(list) && typeof list[effect] === "string") return String(list[effect])
  return EFFECT_FALLBACK[effect] ?? "solid"
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function frac(v: number) {
  return v - Math.floor(v)
}

/** Classic strip HSV (h in [0,1)) → vivid RGB. */
function hsvToRgb(h: number, s: number, v: number): Rgb {
  h = frac(h)
  s = clamp01(s)
  v = clamp01(v)
  if (s <= 0) {
    const g = clampByte(v * 255)
    return [g, g, g]
  }
  const region = h * 6
  const sector = Math.floor(region) % 6
  const f = region - Math.floor(region)
  const p = v * (1 - s)
  const q = v * (1 - s * f)
  const t = v * (1 - s * (1 - f))
  let r = 0
  let g = 0
  let b = 0
  switch (sector) {
    case 0:
      ;[r, g, b] = [v, t, p]
      break
    case 1:
      ;[r, g, b] = [q, v, p]
      break
    case 2:
      ;[r, g, b] = [p, v, t]
      break
    case 3:
      ;[r, g, b] = [p, q, v]
      break
    case 4:
      ;[r, g, b] = [t, p, v]
      break
    default:
      ;[r, g, b] = [v, p, q]
  }
  return [clampByte(r * 255), clampByte(g * 255), clampByte(b * 255)]
}

function scaleRgb(rgb: Rgb, level: number): Rgb {
  const a = clamp01(level)
  return [clampByte(rgb[0] * a), clampByte(rgb[1] * a), clampByte(rgb[2] * a)]
}

/**
 * Map wire speed (0–255) → animation rate.
 * Mid (~128) ≈ one full rainbow cycle / ~1.6s — close to a typical physical strip.
 */
function cyclesPerSecond(speedByte: number): number {
  const t = clamp01(speedByte / 255)
  // ease so low values still move, high values flash quickly
  return 0.18 + Math.pow(t, 0.85) * 1.55
}

function sampleIndex(dot: number): number {
  // 9 preview cells ↔ evenly spaced LEDs on the virtual strip
  return Math.round((dot / 8) * (VIRTUAL_LEDS - 1))
}

function renderLed(
  led: number,
  n: number,
  effect: string,
  phase: number,
  baseRgb: Rgb,
  bri: number,
): Rgb {
  const black: Rgb = [0, 0, 0]
  const white: Rgb = [255, 255, 255]
  const base = scaleRgb(baseRgb, bri)
  // continuous 0..n head position
  const head = frac(phase) * n

  switch (effect) {
    case "solid":
      return base
    case "rainbow": {
      // Full-spectrum traveling rainbow (ignores entity RGB, like firmware)
      const hue = led / n + phase
      return scaleRgb(hsvToRgb(hue, 1, 1), bri)
    }
    case "color_loop": {
      return scaleRgb(hsvToRgb(phase, 1, 1), bri)
    }
    case "chase": {
      const d = Math.min(
        Math.abs(led - head),
        Math.abs(led - head + n),
        Math.abs(led - head - n),
      )
      if (d <= 3.2) {
        const fade = 1 - d * (60 / 255)
        return scaleRgb(baseRgb, fade * bri)
      }
      return black
    }
    case "pulse": {
      const wave = (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)) * bri
      return scaleRgb(baseRgb, wave)
    }
    case "sparkle": {
      const tick = Math.floor(phase * 48)
      const hash = (Math.imul(led, 2654435761) ^ Math.imul(tick, 97)) >>> 0
      if ((hash & 0x3f) < 3) return scaleRgb(white, bri)
      return scaleRgb(baseRgb, bri / 8)
    }
    case "theater": {
      const shift = Math.floor(phase * n * 0.5)
      if ((led + shift) % 3 === 0) return base
      return black
    }
    case "fire": {
      const tick = Math.floor(phase * 40)
      const heat = ((Math.imul(led, 37) + Math.imul(tick, 13)) ^ Math.imul(led, 19)) & 0xff
      const cool = Math.floor((led * 180) / Math.max(1, n))
      const h = heat > cool ? (heat - cool) / 255 : 0
      return scaleRgb([clampByte(h * 255), clampByte((h / 3) * 255), 0], bri)
    }
    case "comet": {
      // trail behind the traveling head
      let d = (head - led) % n
      if (d < 0) d += n
      if (d < 8) {
        const fade = 1 - d * (20 / 255)
        return scaleRgb(baseRgb, fade * bri)
      }
      return black
    }
    case "wave": {
      const w = (Math.sin(led * 0.45 + phase * Math.PI * 2) + 1) * 0.5
      return scaleRgb(baseRgb, w * bri)
    }
    case "scanner": {
      const span = n * 2
      const pos = frac(phase) * span
      const p = pos < n ? pos : span - pos
      const d = Math.abs(led - p)
      if (d < 0.55) return scaleRgb(white, bri)
      if (d < 1.6) return base
      return black
    }
    case "twinkle": {
      const tick = Math.floor(phase * 36)
      const hash = (Math.imul(led, 1103515245) + tick) & 0xff
      return hash > 240 ? base : black
    }
    case "gradient": {
      const t = led / Math.max(1, n - 1)
      const c: Rgb = [
        clampByte(baseRgb[0] + (baseRgb[2] - baseRgb[0]) * t),
        clampByte(baseRgb[1] + (baseRgb[0] - baseRgb[1]) * t),
        clampByte(baseRgb[2] + (baseRgb[1] - baseRgb[2]) * t),
      ]
      return scaleRgb(c, bri)
    }
    case "snow": {
      const tick = Math.floor(phase * 28)
      const hash = (Math.imul(led, 1664525) + Math.imul(tick, 101)) & 0xff
      if (hash > 250) return scaleRgb(white, bri)
      return scaleRgb(baseRgb, bri / 10)
    }
    default: {
      const d = Math.min(
        Math.abs(led - head),
        Math.abs(led - head + n),
        Math.abs(led - head - n),
      )
      if (d < 0.5) return base
      if (d < 1.5) return scaleRgb(baseRgb, 0.35 * bri)
      return scaleRgb(baseRgb, 0.06 * bri)
    }
  }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: [number, number, number, number],
) {
  const [tl, tr, br, bl] = radii.map((v) => Math.max(0, Math.min(v, w / 2, h / 2))) as [
    number,
    number,
    number,
    number,
  ]
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  if (tr > 0) ctx.quadraticCurveTo(x + w, y, x + w, y + tr)
  else ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + h - br)
  if (br > 0) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h)
  else ctx.lineTo(x + w, y + h)
  ctx.lineTo(x + bl, y + h)
  if (bl > 0) ctx.quadraticCurveTo(x, y + h, x, y + h - bl)
  else ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + tl)
  if (tl > 0) ctx.quadraticCurveTo(x, y, x + tl, y)
  else ctx.lineTo(x, y)
  ctx.closePath()
}

type AnimParams = {
  on: boolean
  rgb: Rgb
  bri: number
  speedByte: number
  effect: string
}

/**
 * 3×3 LED strip preview — canvas RAF (60fps), continuous phase, frame-matched corners.
 */
export function StripMatrixIcon({
  entity,
  className,
  size = "md",
}: {
  entity: EntityState
  className?: string
  size?: "sm" | "md"
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paramsRef = useRef<AnimParams>({
    on: false,
    rgb: [255, 200, 80],
    bri: 0.5,
    speedByte: 128,
    effect: "solid",
  })

  const on = entity.state === "on" || entity.state === "home" || entity.state === "open"
  const c = (entity.attributes.rgb_color as number[]) || [255, 200, 80]
  const rgb: Rgb = [c[0] ?? 255, c[1] ?? 200, c[2] ?? 80]
  const brightness = Math.max(0, Math.min(255, Number(entity.attributes.brightness ?? 128)))
  const speedByte = Math.max(0, Math.min(255, Number(entity.attributes.speed ?? 128)))
  const effect = effectNameOf(entity)
  // Keep preview readable at very low strip brightness without inventing wrong hues
  const bri = Math.max(0.35, brightness / 255)

  paramsRef.current = { on, rgb, bri, speedByte, effect }

  const box = size === "sm" ? "h-7 w-7 rounded-lg" : "h-8 w-8 rounded-lg"
  const cssPx = size === "sm" ? 28 : 32

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    const dpr = Math.min(3, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1)
    canvas.width = Math.round(cssPx * dpr)
    canvas.height = Math.round(cssPx * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let raf = 0
    let alive = true

    const paint = (now: number) => {
      if (!alive) return
      const { on: isOn, rgb: baseRgb, bri: level, speedByte: spd, effect: fx } =
        paramsRef.current

      const pad = size === "sm" ? 3 : 3.5
      const gap = size === "sm" ? 2 : 2.5
      const inner = cssPx - pad * 2
      const cell = (inner - gap * 2) / 3
      // Match outer rounded-lg (8px) minus pad so corner LEDs follow the frame
      const cornerR = Math.max(3.5, 8 - pad)

      ctx.clearRect(0, 0, cssPx, cssPx)

      // subtle well
      ctx.fillStyle = "rgba(0,0,0,0.75)"
      roundRectPath(ctx, 0, 0, cssPx, cssPx, [8, 8, 8, 8])
      ctx.fill()

      if (!isOn) {
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            const x = pad + col * (cell + gap)
            const y = pad + row * (cell + gap)
            ctx.fillStyle = "rgba(255,255,255,0.1)"
            roundRectPath(ctx, x, y, cell, cell, cellRadii(col, row, cornerR))
            ctx.fill()
          }
        }
        raf = requestAnimationFrame(paint)
        return
      }

      const cps = cyclesPerSecond(spd)
      const phase = (now / 1000) * cps
      const n = VIRTUAL_LEDS

      for (let i = 0; i < 9; i++) {
        const col = i % 3
        const row = Math.floor(i / 3)
        const led = sampleIndex(i)
        const [r, g, b] = renderLed(led, n, fx, phase, baseRgb, level)
        const lit = r + g + b > 6
        const x = pad + col * (cell + gap)
        const y = pad + row * (cell + gap)
        const radii = cellRadii(col, row, cornerR)

        if (lit) {
          ctx.save()
          ctx.shadowColor = `rgba(${r},${g},${b},0.85)`
          ctx.shadowBlur = 5
          ctx.fillStyle = `rgb(${r},${g},${b})`
          roundRectPath(ctx, x, y, cell, cell, radii)
          ctx.fill()
          ctx.restore()
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.08)"
          roundRectPath(ctx, x, y, cell, cell, radii)
          ctx.fill()
        }
      }

      raf = requestAnimationFrame(paint)
    }

    raf = requestAnimationFrame(paint)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [cssPx, size])

  return (
    <canvas
      ref={canvasRef}
      width={cssPx}
      height={cssPx}
      className={cn(
        "iotvex-strip-matrix shrink-0 border border-white/[0.1]",
        box,
        !on && "opacity-50",
        className,
      )}
      style={{ width: cssPx, height: cssPx }}
      aria-hidden
    />
  )
}
