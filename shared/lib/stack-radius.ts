import { cn } from "@/shared/lib/utils"

export type StackRadius = "md" | "lg" | "xl" | "2xl"

const TOP: Record<StackRadius, string> = {
  md: "rounded-t-md",
  lg: "rounded-t-lg",
  xl: "rounded-t-xl",
  "2xl": "rounded-t-2xl",
}

const BOTTOM: Record<StackRadius, string> = {
  md: "rounded-b-md",
  lg: "rounded-b-lg",
  xl: "rounded-b-xl",
  "2xl": "rounded-b-2xl",
}

const ALL: Record<StackRadius, string> = {
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
}

/**
 * Connected-list radius: first item rounds top, last rounds bottom,
 * middle items stay sharp. Single item keeps full radius.
 */
export function stackRadiusClass(
  index: number,
  total: number,
  radius: StackRadius = "xl",
): string {
  if (total <= 1) return ALL[radius]
  if (index === 0) return cn(TOP[radius], "rounded-b-none")
  if (index === total - 1) return cn(BOTTOM[radius], "rounded-t-none")
  return "rounded-none"
}

/** Collapse adjacent borders so stacked items share one edge. */
export function stackItemOffsetClass(index: number): string {
  return index > 0 ? "-mt-px" : ""
}
