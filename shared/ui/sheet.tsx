"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/shared/lib/utils"

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "iotvex-sheet-overlay",
      className,
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "left" | "right"
  }
>(function SheetContent({ side = "left", className, children, ...props }, ref) {
  const tCommon = useTranslations("common")

  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 flex h-full flex-col gap-0 border-white/10 bg-black/55 shadow-xl outline-none backdrop-blur-xl",
          "iotvex-sheet-panel",
          side === "left" && "iotvex-sheet-left inset-y-0 left-0 w-[min(100vw,20rem)] border-r",
          side === "right" && "iotvex-sheet-right inset-y-0 right-0 w-[min(100vw,20rem)] border-l",
          className,
          // Bottom/side only. Top safe-area would double under opaque status bar.
          "pb-safe",
          side === "left" && "pl-safe",
          side === "right" && "pr-safe",
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-[max(0.75rem,env(safe-area-inset-right,0px))] top-3 rounded-md p-2 text-muted-foreground opacity-80 transition hover:bg-accent hover:opacity-100">
          <X className="h-4 w-4" />
          <span className="sr-only">{tCommon("close")}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = DialogPrimitive.Content.displayName

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-4 pr-12", className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-base font-semibold text-sidebar-foreground", className)}
      {...props}
    />
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle }
