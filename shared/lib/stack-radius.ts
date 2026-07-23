import type { CSSProperties } from "react"
import { cn } from "@/shared/lib/utils"

export type StackRadius = "md" | "lg" | "xl" | "2xl"

const RADIUS_PX: Record<StackRadius, number> = {
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
}

/** Gap between stacked sections with sharp facing corners. */
export const STACK_GAP_PX = 8

/**
 * Stack corners: first → top only, last → bottom only, middle → sharp, single → all.
 * Facing sharp edges keep a visible gap (see stackItemOffset*).
 */
export function stackRadiusStyle(
  index: number,
  total: number,
  radius: StackRadius = "xl",
): CSSProperties {
  const px = RADIUS_PX[radius]
  if (total <= 1) {
    return { borderRadius: px }
  }
  if (index === 0) {
    return {
      borderTopLeftRadius: px,
      borderTopRightRadius: px,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    }
  }
  if (index === total - 1) {
    return {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: px,
      borderBottomRightRadius: px,
    }
  }
  return {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  }
}

export function stackRadiusClass(
  index: number,
  total: number,
  radius: StackRadius = "xl",
): string {
  const t = {
    md: { t: "rounded-t-md", b: "rounded-b-md", a: "rounded-md" },
    lg: { t: "rounded-t-lg", b: "rounded-b-lg", a: "rounded-lg" },
    xl: { t: "rounded-t-xl", b: "rounded-b-xl", a: "rounded-xl" },
    "2xl": { t: "rounded-t-2xl", b: "rounded-b-2xl", a: "rounded-2xl" },
  }[radius]

  if (total <= 1) return t.a
  if (index === 0) return cn(t.t, "rounded-b-none")
  if (index === total - 1) return cn(t.b, "rounded-t-none")
  return "rounded-none"
}

/** Tailwind gap above items after the first (sharp-corner spacing). */
export function stackItemOffsetClass(index: number): string {
  return index > 0 ? "mt-2" : ""
}

export function stackItemOffsetStyle(index: number): CSSProperties {
  return index > 0 ? { marginTop: STACK_GAP_PX } : {}
}
