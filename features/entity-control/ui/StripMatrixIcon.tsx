"use client"

import { cn } from "@/shared/lib/utils"
import type { EntityState } from "@/entities/device/model/types"
import { useEffect, useMemo, useRef } from "react"

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

/** Per-dot corner radii matching the outer rounded-lg frame (TL/TR/BL/BR only). */
const DOT_RADIUS: string[] = [
  "6px 1.5px 1.5px 1.5px", // TL
  "1.5px", // TM
  "1.5px 6px 1.5px 1.5px", // TR
  "1.5px", // ML
  "1.5px", // MM
  "1.5px", // MR
  "1.5px 1.5px 1.5px 6px", // BL
  "1.5px", // BM
  "1.5px 1.5px 6px 1.5px", // BR
]

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

/** Firmware Helpers::hsv_to_rgb — h wrapped to [0,1). */
function hsvToRgb(h: number, s: number, v: number): Rgb {
  h = h - Math.floor(h)
  s = clamp01(s)
  v = clamp01(v)
  if (s <= 0) {
    const g = clampByte(v * 255)
    return [g, g, g]
  }
  const region = h * 6
  const sector = Math.floor(region) % 6
  const frac = region - Math.floor(region)
  const p = v * (1 - s)
  const q = v * (1 - s * frac)
  const t = v * (1 - s * (1 - frac))
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

/** Mirrors firmware animation_step(now_ms, speed_float). */
function animationStep(nowMs: number, speedFloat: number): number {
  const tick = Math.floor(nowMs / 16)
  const speedU8 = Math.max(1, Math.min(100, Math.round(clamp01(speedFloat) * 100)))
  return tick * (1 + Math.floor(speedU8 / 10))
}

function renderDot(
  i: number,
  n: number,
  effect: string,
  step: number,
  baseRgb: Rgb,
  bri: number,
): Rgb {
  const black: Rgb = [0, 0, 0]
  const white: Rgb = [255, 255, 255]
  const base = scaleRgb(baseRgb, bri)

  switch (effect) {
    case "solid":
      return base
    case "rainbow": {
      const hue = i / n + ((step & 0xff) / 255)
      return scaleRgb(hsvToRgb(hue, 1, 1), bri)
    }
    case "color_loop": {
      const hue = (step & 0xff) / 255
      return scaleRgb(hsvToRgb(hue, 1, 1), bri)
    }
    case "chase": {
      const pos = step % n
      const d = Math.min((i - pos + n) % n, (pos - i + n) % n)
      if (d <= 3) {
        const fade = 1 - d * (60 / 255)
        return scaleRgb(baseRgb, fade * bri)
      }
      return black
    }
    case "pulse": {
      const wave = ((Math.sin(step * 0.12) + 1) * 0.5) * bri
      return scaleRgb(baseRgb, wave)
    }
    case "sparkle": {
      const hash = (Math.imul(i, 2654435761) ^ Math.imul(step, 97)) >>> 0
      if ((hash & 0x3f) < 3) return scaleRgb(white, bri)
      return scaleRgb(baseRgb, bri / 8)
    }
    case "theater":
      if (((i + Math.floor(step / 2)) % 3) === 0) return base
      return black
    case "fire": {
      const heat = ((Math.imul(i, 37) + Math.imul(step, 13)) ^ Math.imul(i, 19)) & 0xff
      const cool = Math.floor((i * 180) / Math.max(1, n))
      const h = heat > cool ? (heat - cool) / 255 : 0
      return scaleRgb([clampByte(h * 255), clampByte((h / 3) * 255), 0], bri)
    }
    case "comet": {
      const pos = step % n
      const d = (pos - i + n) % n
      if (d < 8) {
        const fade = 1 - d * (20 / 255)
        return scaleRgb(baseRgb, fade * bri)
      }
      return black
    }
    case "wave": {
      const w = (Math.sin(i * 0.25 + step * 0.15) + 1) * 0.5
      return scaleRgb(baseRgb, w * bri)
    }
    case "scanner": {
      const span = n * 2
      const pos = step % span
      const p = pos < n ? pos : span - 1 - pos
      const d = Math.abs(i - p)
      if (d === 0) return scaleRgb(white, bri)
      if (d === 1) return base
      return black
    }
    case "twinkle": {
      const hash = (Math.imul(i, 1103515245) + step) & 0xff
      return hash > 240 ? base : black
    }
    case "gradient": {
      const t = i / Math.max(1, n - 1)
      const c: Rgb = [
        clampByte(baseRgb[0] + (baseRgb[2] - baseRgb[0]) * t),
        clampByte(baseRgb[1] + (baseRgb[0] - baseRgb[1]) * t),
        clampByte(baseRgb[2] + (baseRgb[1] - baseRgb[2]) * t),
      ]
      return scaleRgb(c, bri)
    }
    case "snow": {
      const hash = (Math.imul(i, 1664525) + Math.imul(step, 101)) & 0xff
      if (hash > 250) return scaleRgb(white, bri)
      return scaleRgb(baseRgb, bri / 10)
    }
    default: {
      const pos = step % n
      const d = (i - pos + n) % n
      if (d === 0) return base
      if (d === 1) return scaleRgb(baseRgb, 0.35 * bri)
      return scaleRgb(baseRgb, 0.06 * bri)
    }
  }
}

/**
 * 3×3 LED preview — firmware-faithful timing/colors, DOM updates (no React lag).
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
  const on = entity.state === "on" || entity.state === "home" || entity.state === "open"
  const rgb = useMemo(() => {
    const c = (entity.attributes.rgb_color as number[]) || [255, 200, 80]
    return [c[0] ?? 255, c[1] ?? 200, c[2] ?? 80] as Rgb
  }, [entity.attributes.rgb_color])
  const brightness = Math.max(0, Math.min(255, Number(entity.attributes.brightness ?? 128)))
  const speedByte = Math.max(0, Math.min(255, Number(entity.attributes.speed ?? 128)))
  const effect = effectNameOf(entity)
  const bri = brightness / 255
  const speedFloat = speedByte / 255

  const rootRef = useRef<HTMLDivElement>(null)
  const dotsRef = useRef<Array<HTMLSpanElement | null>>([])

  const box = size === "sm" ? "h-7 w-7 rounded-lg" : "h-8 w-8 rounded-lg"
  const gap = size === "sm" ? "gap-[2px] p-[3px]" : "gap-[2.5px] p-[3.5px]"

  useEffect(() => {
    const dots = dotsRef.current
    const paintOff = () => {
      for (let i = 0; i < 9; i++) {
        const el = dots[i]
        if (!el) continue
        el.style.backgroundColor = "rgba(255,255,255,0.1)"
        el.style.boxShadow = "none"
      }
    }

    if (!on) {
      paintOff()
      return
    }

    let raf = 0
    let alive = true
    const n = 9

    const paint = (now: number) => {
      if (!alive) return
      const step = animationStep(now, speedFloat)
      for (let i = 0; i < n; i++) {
        const el = dots[i]
        if (!el) continue
        const [r, g, b] = renderDot(i, n, effect, step, rgb, bri)
        const lit = r + g + b > 6
        el.style.backgroundColor = lit ? `rgb(${r},${g},${b})` : "rgba(255,255,255,0.08)"
        el.style.boxShadow = lit ? `0 0 5px rgba(${r},${g},${b},0.75)` : "none"
      }
      raf = requestAnimationFrame(paint)
    }

    raf = requestAnimationFrame(paint)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [on, rgb, bri, speedFloat, effect])

  return (
    <div
      ref={rootRef}
      className={cn(
        "iotvex-strip-matrix grid shrink-0 grid-cols-3 overflow-hidden border border-white/[0.1] bg-black/75",
        box,
        gap,
        !on && "opacity-50",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            dotsRef.current[i] = el
          }}
          className="min-h-0 min-w-0"
          style={{
            borderRadius: DOT_RADIUS[i],
            backgroundColor: "rgba(255,255,255,0.1)",
          }}
        />
      ))}
    </div>
  )
}
