"use client"

import { cn } from "@/shared/lib/utils"
import type { ReactNode } from "react"

export function PageToolbar({
  meta,
  actions,
  title,
  description,
  className,
}: {
  meta?: ReactNode
  actions?: ReactNode
  title?: ReactNode
  description?: ReactNode
  className?: string
}) {
  const left = title ? (
    <div className="min-w-0">
      <div className="text-sm font-semibold text-foreground">
        {title}
      </div>
      {description ? (
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      ) : null}
      {meta ? <div className="mt-1 text-sm text-muted-foreground">{meta}</div> : null}
    </div>
  ) : (
    <div className="min-w-0 text-sm text-muted-foreground">{meta}</div>
  )
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{left}</div>
      {actions ? (
        <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="iotvex-glass-muted flex flex-col items-center justify-center rounded-2xl border-dashed px-6 py-14 text-center animate-[iotvex-card-in_420ms_cubic-bezier(0.22,1,0.36,1)_both]">
      {icon ? <div className="mb-3 text-muted-foreground/60">{icon}</div> : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function SegmentedTabs({
  value,
  onChange,
  onValueChange,
  items,
}: {
  value: string
  onChange?: (v: string) => void
  onValueChange?: (v: string) => void
  items: Array<{ id?: string; value?: string; label: string }>
}) {
  const set = (v: string) => {
    onChange?.(v)
    onValueChange?.(v)
  }
  return (
    <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="iotvex-glass-muted inline-flex min-w-full w-max gap-1 rounded-xl p-1 sm:min-w-0">
        {items.map((item) => {
          const id = item.id ?? item.value ?? item.label
          const active = id === value
          return (
            <button
              key={id}
              type="button"
              onClick={() => set(id)}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function FieldSelect({
  id,
  label,
  value,
  onChange,
  onValueChange,
  options,
  children,
  className,
  disabled,
}: {
  id?: string
  label?: string
  value: string
  onChange?: (v: string) => void
  onValueChange?: (v: string) => void
  options?: Array<{ value: string; label: string }>
  children?: ReactNode
  className?: string
  disabled?: boolean
}) {
  const set = (v: string) => {
    onChange?.(v)
    onValueChange?.(v)
  }
  const select = (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => set(e.target.value)}
      className={cn(
        "flex h-10 w-full min-w-0 appearance-none rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9",
        className,
      )}
    >
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  )
  if (!label) return select
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      {select}
    </div>
  )
}

export function FilterChips({
  value,
  onChange,
  items,
  label,
  className,
}: {
  value: string
  onChange: (v: string) => void
  items: Array<{ id: string; label: string }>
  label?: string
  className?: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label ? (
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      ) : null}
      <div className="-mx-0.5 overflow-x-auto overscroll-x-contain px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-1.5 pb-0.5">
          {items.map((item) => {
            const active = value === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "border-primary/40 bg-primary/12 text-primary"
                    : "border-border/70 text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function StatusDot({
  on,
  tone,
}: {
  on?: boolean
  tone?: "good" | "bad" | "neutral" | boolean
}) {
  const good =
    typeof tone === "boolean" ? tone : tone === "good" ? true : tone === "bad" ? false : on
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        good
          ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.15)]"
          : "bg-muted-foreground/40",
      )}
    />
  )
}

export function CreateCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="iotvex-glass-muted flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 px-4 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {label}
    </button>
  )
}
