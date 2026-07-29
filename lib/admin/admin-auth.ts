/**
 * Admin-Passwort ausschliesslich aus ENV.
 * Kein hartkodierter Fallback — ohne ENV ist Login nicht möglich.
 */
import { readEnvSecret } from "@/lib/security/env-secrets"

export function getAdminPassword(): string {
  return (
    readEnvSecret("ADMIN_PASSWORD") ||
    readEnvSecret("NEXT_PUBLIC_ADMIN_PASSWORD") ||
    ""
  )
}

/** @deprecated Nutze getAdminPassword() — kein Secret-Fallback mehr. */
export const ADMIN_PASSWORD = ""
