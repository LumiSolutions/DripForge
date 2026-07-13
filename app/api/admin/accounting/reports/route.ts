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
} from "@/lib/accounting/reports"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const url = new URL(request.url)
    const from = url.searchParams.get("from")?.trim() || `${new Date().getFullYear()}-01-01`
    const to = url.searchParams.get("to")?.trim() || `${new Date().getFullYear()}-12-31`
    const account = url.searchParams.get("account")?.trim() || undefined

    const [entries, accounts] = await Promise.all([
      cosmosGetJournalEntries({ limit: 500, from, to }),
      cosmosGetChartAccounts(),
    ])

    return NextResponse.json({
      from,
      to,
      ledger: buildLedgerRows(entries, accounts, from, to, account),
      journal: buildJournalReportRows(entries, accounts, from, to),
      incomeStatement: buildIncomeStatement(entries, from, to),
      balanceSheet: buildBalanceSheet(entries, to),
      accounts: accounts.filter((item) => item.type !== "Gruppe"),
    })
  } catch (error) {
    console.error("Admin-API: Berichte konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Berichte konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}
