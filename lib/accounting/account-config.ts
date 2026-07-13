/** Standard-Kontonummern für automatische Verkaufsbuchungen (per Env überschreibbar). */
export type AccountingAccountConfig = {
  revenue3d: string
  revenueLaser: string
  receivable: string
  bank: string
  cash: string
  vatPayable: string
}

export const DEFAULT_ACCOUNTING_ACCOUNT_CONFIG: AccountingAccountConfig = {
  revenue3d: "320001",
  revenueLaser: "3600",
  receivable: "110050",
  bank: "102001",
  cash: "100011",
  vatPayable: "2200",
}

function readEnvAccount(key: string, fallback: string): string {
  const value = process.env[key]?.trim()
  return value || fallback
}

export function getAccountingAccountConfig(): AccountingAccountConfig {
  const defaults = DEFAULT_ACCOUNTING_ACCOUNT_CONFIG
  return {
    revenue3d: readEnvAccount("ACCOUNTING_REVENUE_3D_ACCOUNT", defaults.revenue3d),
    revenueLaser: readEnvAccount(
      "ACCOUNTING_REVENUE_LASER_ACCOUNT",
      defaults.revenueLaser
    ),
    receivable: readEnvAccount(
      "ACCOUNTING_RECEIVABLE_ACCOUNT",
      defaults.receivable
    ),
    bank: readEnvAccount("ACCOUNTING_BANK_ACCOUNT", defaults.bank),
    cash: readEnvAccount("ACCOUNTING_CASH_ACCOUNT", defaults.cash),
    vatPayable: readEnvAccount("ACCOUNTING_VAT_PAYABLE_ACCOUNT", defaults.vatPayable),
  }
}
