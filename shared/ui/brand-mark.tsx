import { cn } from "@/shared/lib/utils"

type BrandMarkProps = {
  className?: string
  size?: number
  priority?: boolean
  alt?: string
}

/** Official Iotvex mark — use anywhere brand identity is needed. */
export function BrandMark({
  className,
  size = 28,
  alt = "Iotvex",
}: BrandMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand-mark.svg"
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      className={cn("shrink-0 select-none object-contain", className)}
    />
  )
}

export function BrandLockup({
  className,
  title = "Iotvex",
  subtitle,
  size = 28,
}: {
  className?: string
  title?: string
  subtitle?: string
  size?: number
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <BrandMark size={size} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
          {title}
        </div>
        {subtitle ? (
          <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
    </div>
  )
}
