import { cn } from "@/shared/lib/utils"

export type StackRadius = "md" | "lg" | "xl" | "2xl"

/**
 * Nested section stack inside a parent card:
 * - first: rounded top only
 * - middle: all sharp
 * - last: rounded bottom only
 * - single: fully rounded
 */
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

/** Collapse adjacent borders so stacked sections share one edge. */
export function stackItemOffsetClass(index: number): string {
  return index > 0 ? "-mt-px" : ""
}
