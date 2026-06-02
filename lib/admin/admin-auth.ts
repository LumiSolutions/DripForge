/** Client-seitiges Admin-Passwort (NEXT_PUBLIC_ fuer Browser-Zugriff). */
export const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "DripForgeAdmin2026!"

export const ADMIN_SESSION_KEY = "dripforge-admin-session"

export function isAdminSessionActive(): boolean {
  if (typeof window === "undefined") return false
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1"
}

export function setAdminSessionActive(active: boolean): void {
  if (typeof window === "undefined") return
  if (active) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "1")
  } else {
    sessionStorage.removeItem(ADMIN_SESSION_KEY)
  }
}

export function verifyAdminPassword(input: string): boolean {
  return input === ADMIN_PASSWORD
}
