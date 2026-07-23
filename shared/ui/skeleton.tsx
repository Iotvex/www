import * as React from "react"

import { cn } from "@/shared/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("iotvex-skeleton animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  )
}

function StatsSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-card/50 backdrop-blur-xl dark:border-white/[0.08] dark:bg-card/35",
        className,
      )}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex min-h-[4.25rem] flex-col justify-between gap-2 px-3 py-3 sm:min-h-[4.75rem]",
              i % 2 === 0 ? "border-r border-border/40" : "",
              "border-b border-border/40 lg:border-b-0",
              i < 3 ? "lg:border-r" : "",
            )}
          >
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

function PageListSkeleton({
  rows = 3,
  dual = false,
  className,
}: {
  rows?: number
  dual?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid gap-2.5",
        dual ? "lg:grid-cols-2" : "",
        className,
      )}
    >
      {Array.from({ length: dual ? rows * 2 : rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-card/35"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
          <Skeleton className="mb-2 h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, StatsSkeleton, PageListSkeleton }
