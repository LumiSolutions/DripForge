export type CustomerAccountStatus = "aktiv" | "gelöscht"

export const DEFAULT_CUSTOMER_ACCOUNT_STATUS: CustomerAccountStatus = "aktiv"

export function normalizeAccountStatus(value: unknown): CustomerAccountStatus {
  return value === "gelöscht" ? "gelöscht" : "aktiv"
}

export function isAccountDeleted(status: unknown): boolean {
  return normalizeAccountStatus(status) === "gelöscht"
}

export function buildDeletedPlaceholderEmail(kundennummer?: string, fallbackId?: string): string {
  const suffix =
    kundennummer?.replace(/-/g, "").trim() ||
    fallbackId?.replace(/[^a-z0-9]/gi, "").slice(0, 16) ||
    String(Date.now())
  return `deleted-user-${suffix}@dripforge.ch`
}
