import { NextResponse } from "next/server"
import { getCustomerByNumber, getOrderById, getSettings } from "@/lib/admin/db"
import { saveCustomer } from "@/lib/admin/customer-store"
import {
  customerDisplayName,
  normalizeCustomerEmail,
} from "@/lib/admin/customers"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { StoredCustomer } from "@/lib/admin/types"
import type { OrderAddress } from "@/lib/dripforge/submit-order"
import { listAllAccounts, saveAccount } from "@/lib/konto/account-db"
import {
  normalizeAccountStatus,
  type CustomerAccountStatus,
} from "@/lib/konto/account-status"
import { buildRewardPointsPublicSettings } from "@/lib/dripforge/reward-points-settings"
import {
  getEffectiveLoyaltyPoints,
  syncLoyaltyAccountBalance,
} from "@/lib/konto/loyalty-points"
import type { LoyaltyPointTransaction } from "@/lib/konto/loyalty-points-config"
import { getDesignsForCustomer } from "@/lib/konto/designs-db"

type RouteContext = { params: Promise<{ id: string }> }

function mergeCustomerStatus(
  customerStatus: unknown,
  portalStatus: unknown
): CustomerAccountStatus {
  const crm = normalizeAccountStatus(customerStatus)
  if (crm === "gelöscht" || crm === "inaktiv") return crm
  return normalizeAccountStatus(portalStatus ?? customerStatus)
}

function parseOrderAddress(
  value: unknown,
  fallback: OrderAddress
): OrderAddress | null {
  if (value == null) return null
  if (typeof value !== "object") return null

  const raw = value as Partial<Record<keyof OrderAddress, unknown>>
  const str = (key: keyof OrderAddress) => {
    const v = raw[key]
    return typeof v === "string" ? v.trim() : fallback[key]
  }

  return {
    firstName: str("firstName"),
    lastName: str("lastName"),
    street: str("street"),
    zip: str("zip"),
    city: str("city"),
    country: str("country") || "CH",
    email: str("email"),
    phone: str("phone"),
  }
}

async function findLinkedPortalAccount(customer: StoredCustomer) {
  const accounts = await listAllAccounts()
  return (
    accounts.find((account) => account.kundennummer === customer.kundennummer) ??
    accounts.find(
      (account) =>
        normalizeCustomerEmail(account.id) ===
          normalizeCustomerEmail(customer.email) ||
        normalizeCustomerEmail(account.email) ===
          normalizeCustomerEmail(customer.email)
    ) ??
    null
  )
}

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

    const portalAccount = await findLinkedPortalAccount(customer)
    const status = mergeCustomerStatus(customer.status, portalAccount?.status)

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

    const designs = portalAccount
      ? await getDesignsForCustomer(portalAccount.email)
      : await getDesignsForCustomer(customer.email)

    return NextResponse.json({
      customer: {
        ...customer,
        name: customerDisplayName(customer.billing),
        status,
      },
      orders,
      designs,
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

export async function PATCH(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const kundennummer = decodeURIComponent(id)
    const customer = await getCustomerByNumber(kundennummer)

    if (!customer) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden." },
        { status: 404 }
      )
    }

    if (normalizeAccountStatus(customer.status) === "gelöscht") {
      return NextResponse.json(
        { error: "Gelöschte Kunden können nicht bearbeitet werden." },
        { status: 400 }
      )
    }

    const body = (await request.json()) as {
      billing?: unknown
      delivery?: unknown | null
      email?: unknown
      status?: unknown
      customerCategoryId?: unknown
    }

    const nextBilling =
      parseOrderAddress(body.billing, customer.billing) ?? customer.billing

    let nextDelivery = customer.delivery
    if (body.delivery === null) {
      nextDelivery = undefined
    } else if (body.delivery !== undefined) {
      const parsed = parseOrderAddress(
        body.delivery,
        customer.delivery ?? customer.billing
      )
      if (parsed) nextDelivery = parsed
    }

    let nextEmail = customer.email
    if (typeof body.email === "string" && body.email.trim()) {
      nextEmail = normalizeCustomerEmail(body.email)
    } else {
      nextEmail = normalizeCustomerEmail(nextBilling.email || customer.email)
    }

    // Keep billing.email aligned with top-level email
    nextBilling.email = nextEmail

    let nextStatus = normalizeAccountStatus(customer.status)
    if (body.status !== undefined) {
      if (body.status === "gelöscht") {
        return NextResponse.json(
          {
            error:
              "Status «gelöscht» kann über dieses Endpoint nicht gesetzt werden.",
          },
          { status: 400 }
        )
      }
      if (body.status !== "aktiv" && body.status !== "inaktiv") {
        return NextResponse.json(
          { error: "Ungültiger Status. Erlaubt: aktiv, inaktiv." },
          { status: 400 }
        )
      }
      nextStatus = body.status
    }

    let nextCategoryId = customer.customerCategoryId ?? null
    if (body.customerCategoryId !== undefined) {
      nextCategoryId =
        typeof body.customerCategoryId === "string" && body.customerCategoryId.trim()
          ? body.customerCategoryId.trim()
          : null
    }

    const updated: StoredCustomer = {
      ...customer,
      email: nextEmail,
      billing: nextBilling,
      delivery: nextDelivery,
      status: nextStatus,
      customerCategoryId: nextCategoryId,
    }

    const saved = await saveCustomer(updated)

    const portalAccount = await findLinkedPortalAccount(customer)
    if (portalAccount) {
      await saveAccount({
        ...portalAccount,
        email: nextEmail,
        firstName: nextBilling.firstName,
        lastName: nextBilling.lastName,
        phone: nextBilling.phone || portalAccount.phone,
        street: nextBilling.street || portalAccount.street,
        zip: nextBilling.zip || portalAccount.zip,
        city: nextBilling.city || portalAccount.city,
        status: nextStatus,
        // Kategorie mit dem Portal-Konto synchronisieren (Shop-Preislogik nutzt das Konto).
        customerCategoryId: nextCategoryId,
      })
    }

    return NextResponse.json({
      customer: {
        ...saved,
        name: customerDisplayName(saved.billing),
        status: nextStatus,
      },
    })
  } catch (error) {
    console.warn("Admin-API: Kunde konnte nicht aktualisiert werden.", error)
    return NextResponse.json(
      { error: "Kunde konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }
}
