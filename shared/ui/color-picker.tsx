"use client"

import { cn } from "@/shared/lib/utils"
import { ColorPickerDialog } from "@/shared/ui/color-picker-dialog"
import type { Rgb } from "@/shared/ui/color-math"
import { useMemo, useState } from "react"

export type { Rgb } from "@/shared/ui/color-math"
export { rgbToHsv, hsvToRgb } from "@/shared/ui/color-math"

/** Compact swatch that opens the full color picker dialog. */
export function ColorPicker({
  value,
  disabled,
  onChange,
  onCommit,
  className,
}: {
  value: Rgb
  disabled?: boolean
  onChange?: (rgb: Rgb) => void
  onCommit: (rgb: Rgb) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const preview = useMemo(() => `rgb(${value.join(",")})`, [value])

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-label="Open color picker"
        className={cn(
          "h-8 w-8 shrink-0 rounded-md border border-border/70 shadow-sm transition",
          "hover:ring-2 hover:ring-ring/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        style={{ background: preview }}
        onClick={() => setOpen(true)}
      />
      <span className="truncate font-mono text-xs tabular-nums text-muted-foreground">
        #{value.map((c) => c.toString(16).padStart(2, "0")).join("")}
      </span>
      <ColorPickerDialog
        open={open}
        onOpenChange={setOpen}
        value={value}
        disabled={disabled}
        onChange={onChange}
        onCommit={onCommit}
      />
    </div>
  )
}
