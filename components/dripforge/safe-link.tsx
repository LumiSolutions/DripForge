"use client"

import Link from "next/link"
import type { ComponentProps, MouseEvent } from "react"
import {
  hardNavigate,
  hrefToPathname,
  isRestrictedInAppBrowser,
} from "@/lib/dripforge/safe-navigate"

type SafeLinkProps = ComponentProps<typeof Link>

/**
 * Next.js Link mit Hard-Navigation-Fallback für Instagram/Incognito-WebViews.
 * Prefetch ist standardmässig aus (weniger Fehler in restriktiven Browsern).
 */
export function SafeLink({
  href,
  prefetch = false,
  onClick,
  children,
  ...rest
}: SafeLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return

    const url =
      typeof href === "string"
        ? href
        : href.pathname
          ? `${href.pathname}${href.search ?? ""}${href.hash ?? ""}`
          : null

    if (!url || url.startsWith("#") || url.startsWith("mailto:") || url.startsWith("tel:")) {
      return
    }

    // Externe Links / neue Tabs nicht anfassen
    if (rest.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }

    // Instagram/FB WebViews: Client-Router oft kaputt → harte Navigation
    if (isRestrictedInAppBrowser()) {
      event.preventDefault()
      hardNavigate(url)
      return
    }

    // Soft-Routing mit Hard-Fallback, falls die URL nicht wechselt
    const expected = hrefToPathname(url)
    window.setTimeout(() => {
      const current = window.location.pathname || "/"
      const matched =
        expected === "/"
          ? current === "/"
          : current === expected || current.startsWith(`${expected}/`)
      if (!matched) hardNavigate(url)
    }, 700)
  }

  return (
    <Link href={href} prefetch={prefetch} onClick={handleClick} {...rest}>
      {children}
    </Link>
  )
}
