/** Fallback Admin-Passwort (serverseitig bevorzugt ADMIN_PASSWORD). */
export const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD?.trim() ||
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() ||
  "DripForgeAdmin2026!"
