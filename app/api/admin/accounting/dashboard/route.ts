import { NextResponse } from "next/server"
import { cosmosGetChartAccounts } from "@/lib/admin/cosmos-chart-accounts"
import { cosmosGetJournalEntries } from "@/lib/admin/cosmos-journal"
import {
  computeCashFlowSummary,
  defaultYearRange,
  emptyCashFlowSummary,
} from "@/lib/accounting/dashboard-stats"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear())
  const range = defaultYearRange(year)
  const from = url.searchParams.get("from")?.trim() || range.from
  const to = url.searchParams.get("to")?.trim() || range.to

  try {
    let accounts: Awaited<ReturnType<typeof cosmosGetChartAccounts>> = []
    let entries: Awaited<ReturnType<typeof cosmosGetJournalEntries>> = []

    try {
      accounts = await cosmosGetChartAccounts()
    } catch (error) {
      console.error("Admin-API: Konten für Dashboard nicht geladen.", error)
      accounts = []
    }

    try {
      entries = await cosmosGetJournalEntries({ limit: 500, from, to })
    } catch (error) {
      console.error("Admin-API: Journal für Dashboard nicht geladen.", error)
      entries = []
    }

    const summary = computeCashFlowSummary(entries ?? [], accounts ?? [], from, to, year)

    return NextResponse.json({
      from,
      to,
      label: range.label,
      summary,
    })
  } catch (error) {
    console.error("Admin-API: Buchhaltungs-Dashboard konnte nicht geladen werden.", error)
    return NextResponse.json({
      from,
      to,
      label: range.label,
      summary: emptyCashFlowSummary(year),
    })
  }
}
