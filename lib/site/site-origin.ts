/** Öffentliche Site-URL für Links in E-Mails (z. B. Admin-Dashboard). */
export function resolveSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/$/, "")}`
  }
  return "http://localhost:3000"
}
