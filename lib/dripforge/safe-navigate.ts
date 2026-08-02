/**
 * Navigation, die auch in Instagram-/Facebook-In-App-Browsern und bei
 * kaputtem History-API Client-Routing funktioniert.
 */

export function isRestrictedInAppBrowser(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : ""
): boolean {
  return /Instagram|FBAN|FBAV|FBIOS|FB_IAB|Messenger|Line\//i.test(userAgent)
}

export function hrefToPathname(href: string): string {
  try {
    const url = new URL(href, "https://dripforge.ch")
    return url.pathname || "/"
  } catch {
    return href.split("?")[0] || "/"
  }
}

/** Harte Navigation — immer zuverlässig, auch ohne Client-Router. */
export function hardNavigate(href: string): void {
  if (typeof window === "undefined") return
  try {
    window.location.assign(href)
  } catch {
    window.location.href = href
  }
}

/**
 * Soft-Navigation mit Hard-Fallback.
 * In Instagram/FB WebViews direkt hard navigieren.
 */
export function safeNavigate(
  href: string,
  options?: {
    routerPush?: (href: string) => void
    forceHard?: boolean
  }
): void {
  const target = href || "/"
  const forceHard =
    options?.forceHard === true || isRestrictedInAppBrowser()

  if (forceHard || !options?.routerPush) {
    hardNavigate(target)
    return
  }

  try {
    options.routerPush(target)
    const expected = hrefToPathname(target)
    window.setTimeout(() => {
      const current = window.location.pathname || "/"
      const matched =
        expected === "/"
          ? current === "/"
          : current === expected || current.startsWith(`${expected}/`)
      if (!matched) {
        hardNavigate(target)
      }
    }, 600)
  } catch {
    hardNavigate(target)
  }
}
