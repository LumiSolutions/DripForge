import type { Account } from "@/lib/accounting/account-types"
import type { JournalEntry, JournalLine } from "@/lib/accounting/journal-types"

export type MonthlyCashFlow = {
  month: number
  label: string
  income: number
  expense: number
}

export type CashFlowSummary = {
  months: MonthlyCashFlow[]
  totalIncome: number
  totalExpense: number
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
]

function roundChf(value: number): number {
  return Math.round(value * 100) / 100
}

function isLiquidAssetAccount(account: Account): boolean {
  if (account.type !== "Aktiv" || account.isActive === false) return false
  if (account.number.startsWith("100") || account.number.startsWith("102")) return true
  const name = account.name.toLowerCase()
  return (
    name.includes("kasse") ||
    name.includes("bank") ||
    name.includes("postfinance") ||
    name.includes("raiffeisen")
  )
}

export function buildLiquidAccountSet(accounts: Account[]): Set<string> {
  return new Set(accounts.filter(isLiquidAssetAccount).map((account) => account.number))
}

function isInRange(dateIso: string, from: string, to: string): boolean {
  return dateIso >= from && dateIso <= to
}

function lineTouchesLiquid(line: JournalLine, liquidAccounts: Set<string>): boolean {
  return liquidAccounts.has(line.accountNumber)
}

export function computeCashFlowSummary(
  entries: JournalEntry[],
  accounts: Account[],
  from: string,
  to: string,
  year: number
): CashFlowSummary {
  const liquidAccounts = buildLiquidAccountSet(accounts)
  const months: MonthlyCashFlow[] = MONTH_LABELS.map((label, index) => ({
    month: index + 1,
    label: `${label} ${year}`,
    income: 0,
    expense: 0,
  }))

  let totalIncome = 0
  let totalExpense = 0

  for (const entry of entries) {
    if (!isInRange(entry.date, from, to)) continue
    const monthIndex = Number(entry.date.slice(5, 7)) - 1
    if (monthIndex < 0 || monthIndex > 11) continue

    for (const line of entry.lines) {
      if (!lineTouchesLiquid(line, liquidAccounts)) continue
      const amount = roundChf(line.amount)
      if (line.type === "SOLL") {
        months[monthIndex].income = roundChf(months[monthIndex].income + amount)
        totalIncome = roundChf(totalIncome + amount)
      } else {
        months[monthIndex].expense = roundChf(months[monthIndex].expense + amount)
        totalExpense = roundChf(totalExpense + amount)
      }
    }
  }

  return { months, totalIncome, totalExpense }
}

export function defaultYearRange(year: number): { from: string; to: string; label: string } {
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  return {
    from,
    to,
    label: `01.01.${year} - 31.12.${year}`,
  }
}

/** Leeres Dashboard bei fehlenden Buchungen oder API-Fehlern. */
export function emptyCashFlowSummary(year: number): CashFlowSummary {
  return {
    months: MONTH_LABELS.map((label, index) => ({
      month: index + 1,
      label: `${label} ${year}`,
      income: 0,
      expense: 0,
    })),
    totalIncome: 0,
    totalExpense: 0,
  }
}
