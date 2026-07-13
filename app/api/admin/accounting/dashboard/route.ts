import { NextResponse } from "next/server"
import { cosmosGetChartAccounts } from "@/lib/admin/cosmos-chart-accounts"
import { cosmosGetJournalEntries } from "@/lib/admin/cosmos-journal"
import { computeCashFlowSummary, defaultYearRange } from "@/lib/accounting/dashboard-stats"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const url = new URL(request.url)
    const year = Number(url.searchParams.get("year") ?? new Date().getFullYear())
    const range = defaultYearRange(year)
    const from = url.searchParams.get("from")?.trim() || range.from
    const to = url.searchParams.get("to")?.trim() || range.to

    const [accounts, entries] = await Promise.all([
      cosmosGetChartAccounts(),
      cosmosGetJournalEntries({ limit: 500, from, to }),
    ])

    const summary = computeCashFlowSummary(entries, accounts, from, to, year)

    return NextResponse.json({
      from,
      to,
      label: range.label,
      summary,
    })
  } catch (error) {
    console.error("Admin-API: Buchhaltungs-Dashboard konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Dashboard konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}
