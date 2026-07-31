export type CustomerAccountStatus = "aktiv" | "inaktiv" | "gelöscht"

export const DEFAULT_CUSTOMER_ACCOUNT_STATUS: CustomerAccountStatus = "aktiv"

export function normalizeAccountStatus(value: unknown): CustomerAccountStatus {
  if (value === "gelöscht") return "gelöscht"
  if (value === "inaktiv") return "inaktiv"
  return "aktiv"
}

export function isAccountDeleted(status: unknown): boolean {
  return normalizeAccountStatus(status) === "gelöscht"
}

export function isAccountActive(status: unknown): boolean {
  return normalizeAccountStatus(status) === "aktiv"
}

export function buildDeletedPlaceholderEmail(kundennummer?: string, fallbackId?: string): string {
  const suffix =
    kundennummer?.replace(/-/g, "").trim() ||
    fallbackId?.replace(/[^a-z0-9]/gi, "").slice(0, 16) ||
    String(Date.now())
  return `deleted-user-${suffix}@dripforge.ch`
}
