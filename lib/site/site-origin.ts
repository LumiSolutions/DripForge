/**
 * Öffentliche Site-URL für Links in E-Mails (Reset, Bestätigung, Admin-Dashboard).
 *
 * Primär ENV — niemals Request-Host / Docker-Hostname.
 * Fallback: https://dripforge.ch
 */
export function resolveSiteOrigin(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
  ]

  for (const raw of candidates) {
    const value = raw?.trim()
    if (value) return value.replace(/\/$/, "")
  }

  return "https://dripforge.ch"
}
