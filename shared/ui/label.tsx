
"use client"

import * as React from "react"
import { cn } from "@/shared/lib/utils"

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  )
}
