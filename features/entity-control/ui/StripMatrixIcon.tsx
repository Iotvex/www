"use client"

import { cn } from "@/shared/lib/utils"
import type { EntityState } from "@/entities/device/model/types"
import { useEffect, useMemo, useState } from "react"

type RgbTriple = [number, number, number]

function effectNameOf(entity: EntityState): string {
  const list = entity.attributes.effect_list
  const effect = Number(entity.attributes.effect ?? 0)
  if (Array.isArray(list) && typeof list[effect] === "string") return String(list[effect])
  const fallback = [
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
  return fallback[effect] ?? "solid"
}

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function scaleRgb(rgb: RgbTriple, level: number): RgbTriple {
  const a = Math.max(0, Math.min(1, level))
  return [clampByte(rgb[0] * a), clampByte(rgb[1] * a), clampByte(rgb[2] * a)]
}

function hueRgb(hue: number, level = 1): RgbTriple {
  const h = ((hue % 360) + 360) % 360
  const x = 1 - Math.abs(((h / 60) % 2) - 1)
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [1, x, 0]
  else if (h < 120) [r, g, b] = [x, 1, 0]
  else if (h < 180) [r, g, b] = [0, 1, x]
  else if (h < 240) [r, g, b] = [0, x, 1]
  else if (h < 300) [r, g, b] = [x, 0, 1]
  else [r, g, b] = [1, 0, x]
  return scaleRgb([r * 255, g * 255, b * 255], level)
}

function stripPeriodMs(speedByte: number) {
  const pct = Math.max(1, Math.min(255, speedByte)) / 255
  return Math.round(2200 - pct * 1920)
}

/** 3×3 LED matrix — miniaturized strip effect emulation. */
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
    return [c[0] ?? 255, c[1] ?? 200, c[2] ?? 80] as RgbTriple
  }, [entity.attributes.rgb_color])
  const brightness = Math.max(1, Math.min(255, Number(entity.attributes.brightness ?? 128)))
  const speed = Math.max(1, Math.min(255, Number(entity.attributes.speed ?? 128)))
  const effect = effectNameOf(entity)
  const bri = brightness / 255
  const [cells, setCells] = useState<RgbTriple[]>(() => Array.from({ length: 9 }, () => [0, 0, 0] as RgbTriple))
  const box = size === "sm" ? "h-7 w-7 rounded-lg" : "h-8 w-8 rounded-lg"
  const gap = size === "sm" ? "gap-[2px] p-[3px]" : "gap-[3px] p-[4px]"
  const dot = size === "sm" ? "h-[5px] w-[5px]" : "h-[6px] w-[6px]"

  useEffect(() => {
    if (!on) {
      setCells(Array.from({ length: 9 }, () => [0, 0, 0] as RgbTriple))
      return
    }

    let raf = 0
    let alive = true
    const period = stripPeriodMs(speed)
    const base = scaleRgb(rgb, bri)
    const start = performance.now()

    const paint = (now: number) => {
      if (!alive) return
      const t = (now - start) / period
      const phase = t - Math.floor(t)
      const next: RgbTriple[] = Array.from({ length: 9 }, () => [0, 0, 0] as RgbTriple)

      const setDot = (i: number, color: RgbTriple, level = 1) => {
        next[i] = scaleRgb(color, Math.max(0, Math.min(1, level)))
      }

      if (effect === "solid" || effect === "gradient") {
        for (let i = 0; i < 9; i++) {
          const row = Math.floor(i / 3)
          const level = effect === "gradient" ? 0.35 + (row / 2) * 0.65 : 1
          setDot(i, base, level)
        }
      } else if (effect === "rainbow" || effect === "color_loop") {
        for (let i = 0; i < 9; i++) setDot(i, hueRgb((t * 360 + i * 40) % 360, bri))
      } else if (effect === "pulse") {
        const level = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2))
        for (let i = 0; i < 9; i++) setDot(i, base, level)
      } else if (
        effect === "chase" ||
        effect === "comet" ||
        effect === "wave" ||
        effect === "scanner" ||
        effect === "theater"
      ) {
        const head = Math.floor(phase * 9) % 9
        for (let i = 0; i < 9; i++) {
          const dist = (i - head + 9) % 9
          let level = 0
          if (dist === 0) level = 1
          else if (dist === 1) level = effect === "comet" || effect === "wave" ? 0.45 : 0.18
          else if (dist === 2 && (effect === "comet" || effect === "scanner")) level = 0.18
          else if (effect === "theater" && i % 2 === head % 2) level = 0.85
          else if (effect === "theater") level = 0.12
          setDot(i, base, level)
        }
      } else if (effect === "fire") {
        for (let i = 0; i < 9; i++) {
          const row = Math.floor(i / 3)
          const col = i % 3
          const flicker =
            0.35 +
            0.65 *
              (0.5 +
                0.5 * Math.sin(phase * Math.PI * 2 * (1.6 + col * 0.3) + row * 1.1 + col))
          const heat = (2 - row) / 2
          const level = Math.max(0.08, flicker * (0.35 + heat * 0.65) * bri)
          setDot(i, [255, clampByte(40 + heat * 140 + flicker * 40), clampByte(flicker * 30)], level)
        }
      } else if (effect === "sparkle" || effect === "twinkle" || effect === "snow") {
        const seed = Math.floor(t * (effect === "snow" ? 12 : 18))
        for (let i = 0; i < 9; i++) {
          const n = Math.sin((seed + i * 17) * 12.9898) * 43758.5453
          const spark = n - Math.floor(n)
          const lit = spark > (effect === "snow" ? 0.72 : 0.62)
          if (!lit) {
            setDot(i, base, effect === "snow" ? 0.06 : 0.08)
            continue
          }
          setDot(i, effect === "snow" ? scaleRgb([220, 235, 255], bri) : base, 0.55 + spark * 0.45)
        }
      } else {
        const head = Math.floor(phase * 9) % 9
        for (let i = 0; i < 9; i++) {
          const dist = (i - head + 9) % 9
          setDot(i, base, dist === 0 ? 1 : dist === 1 ? 0.35 : 0.08)
        }
      }

      setCells(next)
      raf = requestAnimationFrame(paint)
    }

    raf = requestAnimationFrame(paint)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [on, rgb, bri, speed, effect])

  return (
    <div
      className={cn(
        "iotvex-strip-matrix grid shrink-0 grid-cols-3 border border-white/[0.08] bg-black/70 backdrop-blur-md",
        box,
        gap,
        !on && "opacity-45",
        className,
      )}
      aria-hidden
    >
      {cells.map((c, i) => {
        const lit = on && c[0] + c[1] + c[2] > 8
        return (
          <span
            key={i}
            className={cn("rounded-[1px]", dot)}
            style={{
              backgroundColor: lit ? `rgb(${c[0]}, ${c[1]}, ${c[2]})` : "rgba(255,255,255,0.08)",
              boxShadow: lit ? `0 0 4px rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.85)` : "none",
            }}
          />
        )
      })}
    </div>
  )
}
