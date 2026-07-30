import { NextResponse } from "next/server"
import { getCustomerByNumber, getOrderById, getSettings } from "@/lib/admin/db"
import { customerDisplayName, normalizeCustomerEmail } from "@/lib/admin/customers"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { listAllAccounts } from "@/lib/konto/account-db"
import { normalizeAccountStatus } from "@/lib/konto/account-status"
import { buildRewardPointsPublicSettings } from "@/lib/dripforge/reward-points-settings"
import {
  getEffectiveLoyaltyPoints,
  syncLoyaltyAccountBalance,
} from "@/lib/konto/loyalty-points"
import type { LoyaltyPointTransaction } from "@/lib/konto/loyalty-points-config"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const customer = await getCustomerByNumber(decodeURIComponent(id))

    if (!customer) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden." },
        { status: 404 }
      )
    }

    const accounts = await listAllAccounts()
    const portalAccount =
      accounts.find((account) => account.kundennummer === customer.kundennummer) ??
      accounts.find(
        (account) =>
          normalizeCustomerEmail(account.id) ===
          normalizeCustomerEmail(customer.email)
      )

    const status =
      normalizeAccountStatus(customer.status) === "gelöscht"
        ? "gelöscht"
        : normalizeAccountStatus(portalAccount?.status)

    const orders = (
      await Promise.all(customer.orderIds.map((orderId) => getOrderById(orderId)))
    )
      .filter((order): order is NonNullable<typeof order> => order != null)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

    const rewardCfg = buildRewardPointsPublicSettings(await getSettings())
    let loyaltyPoints = 0
    let loyaltyHistory: LoyaltyPointTransaction[] = []
    let hasPortalAccount = false

    if (portalAccount) {
      hasPortalAccount = true
      const synced =
        (await syncLoyaltyAccountBalance(
          portalAccount.email,
          rewardCfg.loyaltyPointsExpiryMonths
        )) ?? portalAccount
      loyaltyPoints = getEffectiveLoyaltyPoints(
        synced,
        rewardCfg.loyaltyPointsExpiryMonths
      )
      loyaltyHistory = [...(synced.loyaltyPointTransactions ?? [])]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 30)
    }

    return NextResponse.json({
      customer: {
        ...customer,
        name: customerDisplayName(customer.billing),
        status,
      },
      orders,
      loyalty: {
        points: loyaltyPoints,
        history: loyaltyHistory,
        hasPortalAccount,
        pointValueChf: rewardCfg.loyaltyPointValueChf,
        enabled: rewardCfg.enableRewardPointsSystem,
      },
    })
  } catch (error) {
    console.warn("Admin-API: Kunde konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Kunde konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}
