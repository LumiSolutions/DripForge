import { NextResponse } from "next/server"
import { cosmosGetChartAccounts } from "@/lib/admin/cosmos-chart-accounts"
import { cosmosGetJournalEntries } from "@/lib/admin/cosmos-journal"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import {
  buildBalanceSheet,
  buildIncomeStatement,
  buildJournalReportRows,
  buildLedgerRows,
  emptyBalanceSheetLayout,
  emptyIncomeStatementLayout,
} from "@/lib/accounting/reports"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const from = url.searchParams.get("from")?.trim() || `${new Date().getFullYear()}-01-01`
  const to = url.searchParams.get("to")?.trim() || `${new Date().getFullYear()}-12-31`
  const account = url.searchParams.get("account")?.trim() || undefined

  try {
    let entries: Awaited<ReturnType<typeof cosmosGetJournalEntries>> = []
    let accounts: Awaited<ReturnType<typeof cosmosGetChartAccounts>> = []

    try {
      entries = await cosmosGetJournalEntries({ limit: 500, from, to })
    } catch (error) {
      console.error("Admin-API: Journal für Berichte nicht geladen.", error)
      entries = []
    }

    try {
      accounts = await cosmosGetChartAccounts()
    } catch (error) {
      console.error("Admin-API: Konten für Berichte nicht geladen.", error)
      accounts = []
    }

    const safeEntries = entries ?? []
    const safeAccounts = accounts ?? []

    return NextResponse.json({
      from,
      to,
      ledger: buildLedgerRows(safeEntries, safeAccounts, from, to, account),
      journal: buildJournalReportRows(safeEntries, safeAccounts, from, to),
      incomeStatement: buildIncomeStatement(safeEntries, from, to),
      balanceSheet: buildBalanceSheet(safeEntries, to),
      accounts: safeAccounts.filter((item) => item.type !== "Gruppe"),
    })
  } catch (error) {
    console.error("Admin-API: Berichte konnten nicht geladen werden.", error)
    return NextResponse.json({
      from,
      to,
      ledger: [],
      journal: [],
      incomeStatement: emptyIncomeStatementLayout(),
      balanceSheet: emptyBalanceSheetLayout(),
      accounts: [],
    })
  }
}
