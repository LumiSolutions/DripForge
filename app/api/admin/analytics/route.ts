import { NextResponse } from "next/server"
import { getAdminAnalytics } from "@/lib/admin/order-analytics"
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
  generatedAt: new Date().toISOString(),
}

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const analytics = await getAdminAnalytics()
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
