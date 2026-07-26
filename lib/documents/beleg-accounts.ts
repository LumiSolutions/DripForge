import { getAccountingAccountConfig } from "@/lib/accounting/account-config"
import type { Account } from "@/lib/accounting/account-types"

/** Standard-Ertragskonto für neue Beleg-Positionen. */
export function defaultBelegRevenueAccountCode(): string {
  return getAccountingAccountConfig().revenue3d
}

export function isRevenueAccount(account: Account): boolean {
  return account.isActive !== false && account.type === "Ertrag"
}

export function filterRevenueAccounts(accounts: Account[]): Account[] {
  return accounts
    .filter(isRevenueAccount)
    .sort((a, b) => a.number.localeCompare(b.number, "de-CH"))
}

export function formatRevenueAccountLabel(account: Account): string {
  return `${account.number} – ${account.name}`
}

export function resolveBelegAccountCode(
  accountCode: string | null | undefined,
  revenueAccounts?: Account[]
): string {
  const trimmed = String(accountCode ?? "").trim()
  if (trimmed) {
    if (!revenueAccounts?.length) return trimmed
    if (revenueAccounts.some((a) => a.number === trimmed)) return trimmed
  }
  const fallback = defaultBelegRevenueAccountCode()
  if (revenueAccounts?.some((a) => a.number === fallback)) return fallback
  return revenueAccounts?.[0]?.number ?? fallback
}
