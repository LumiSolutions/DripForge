/** Deep-Link zur SPA-Startseite (Launch-Gate / DripForgeApp). */
export function shopViewHref(viewId: string): string {
  if (viewId === "home") return "/"
  if (viewId === "kontakt") return "/kontakt"
  return `/?view=${encodeURIComponent(viewId)}`
}

export function shopCartHref(): string {
  return "/?view=warenkorb"
}
