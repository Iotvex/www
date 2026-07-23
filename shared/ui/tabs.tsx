"use client"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/shared/lib/utils"

export const Tabs = TabsPrimitive.Root

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex h-9 w-full flex-wrap items-center gap-1 rounded-xl border border-border/70 bg-muted/40 p-1 text-muted-foreground sm:w-auto",
        className,
      )}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex min-h-7 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all sm:flex-none sm:text-sm",
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-4 focus-visible:outline-none", className)}
      {...props}
    />
  )
}
