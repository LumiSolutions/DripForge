import { NextResponse } from "next/server"
import {
  getAdminAnalytics,
  normalizeAnalyticsChartDays,
} from "@/lib/admin/order-analytics"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { logCosmosError } from "@/lib/cosmos/log-error"
import type { AdminAnalytics } from "@/lib/admin/analytics-types"

const EMPTY_ANALYTICS: AdminAnalytics = {
  summary: {
    totalRevenueChf: 0,
    orderCount: 0,
    openOrderCount: 0,
    averageOrderValueChf: 0,
  },
  timeSeries: [],
  topProducts: [],
  topOptions: [],
  topBuyers: [],
  generatedAt: new Date().toISOString(),
}

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { searchParams } = new URL(request.url)
    const days = normalizeAnalyticsChartDays(searchParams.get("days"))
    const analytics = await getAdminAnalytics(days)
    return NextResponse.json(analytics, {
      headers: { "Cache-Control": "private, max-age=60" },
    })
  } catch (error) {
    logCosmosError("admin-analytics", error)
    return NextResponse.json(EMPTY_ANALYTICS, {
      headers: { "X-DripForge-Degraded": "1" },
    })
  }
}
