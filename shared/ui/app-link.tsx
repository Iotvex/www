
"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  forwardRef,
  type ComponentProps,
  type MouseEvent,
  startTransition,
} from "react"

type Props = ComponentProps<typeof Link> & {
  onNavigate?: () => void
}

/**
 * Client navigation with optional View Transitions — shell stays mounted.
 */
export const AppLink = forwardRef<HTMLAnchorElement, Props>(function AppLink(
  { href, onClick, onNavigate, replace, scroll = false, ...rest },
  ref,
) {
  const router = useRouter()

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const url = typeof href === "string" ? href : href.pathname || "/"
    if (url.startsWith("http") || url.startsWith("mailto:")) return
    e.preventDefault()
    onNavigate?.()

    const go = () => {
      startTransition(() => {
        if (replace) router.replace(url, { scroll })
        else router.push(url, { scroll })
      })
    }

    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> }
    }
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(go)
    } else {
      go()
    }
  }

  return (
    <Link ref={ref} href={href} scroll={scroll} replace={replace} onClick={handleClick} {...rest} />
  )
})
