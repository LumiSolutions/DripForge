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
import type { SavedDeliveryAddress } from "@/lib/konto/account-types"
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
import {
  getDefaultDeliveryAddress,
  legacyFieldsFromDeliveryAddresses,
  normalizeDeliveryAddresses,
  parseSavedDeliveryAddresses,
} from "@/lib/konto/delivery-addresses"

type RouteContext = { params: Promise<{ id: string }> }

function mergeCustomerStatus(
  customerStatus: unknown,
  portalStatus: unknown
): CustomerAccountStatus {
  const crm = normalizeAccountStatus(customerStatus)
  if (crm === "gelöscht" || crm === "inaktiv") return crm
  return normalizeAccountStatus(portalStatus ?? customerStatus)
}

/** Expose deliveryAddresses with legacy `delivery` synthesized when needed. */
function withNormalizedDeliveryAddresses(customer: StoredCustomer): StoredCustomer {
  const deliveryAddresses = normalizeDeliveryAddresses(
    customer.deliveryAddresses,
    customer.delivery
      ? {
          deliveryStreet: customer.delivery.street,
          deliveryZip: customer.delivery.zip,
          deliveryCity: customer.delivery.city,
          deliverySameAsBilling: false,
        }
      : undefined
  )
  return { ...customer, deliveryAddresses }
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
        ...withNormalizedDeliveryAddresses(customer),
        // Portal-Kategorie hat Vorrang, falls CRM-Feld fehlt/veraltet.
        customerCategoryId:
          portalAccount?.customerCategoryId ?? customer.customerCategoryId ?? null,
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
      deliveryAddresses?: unknown
      defaultDeliveryAddressId?: unknown
      email?: unknown
      status?: unknown
      customerCategoryId?: unknown
    }

    const nextBilling =
      parseOrderAddress(body.billing, customer.billing) ?? customer.billing

    let nextDeliveryAddresses = normalizeDeliveryAddresses(
      customer.deliveryAddresses,
      customer.delivery
        ? {
            deliveryStreet: customer.delivery.street,
            deliveryZip: customer.delivery.zip,
            deliveryCity: customer.delivery.city,
            deliverySameAsBilling: false,
          }
        : undefined
    )

    if (body.deliveryAddresses !== undefined) {
      const parsed = parseSavedDeliveryAddresses(body.deliveryAddresses)
      const defaultId =
        typeof body.defaultDeliveryAddressId === "string"
          ? body.defaultDeliveryAddressId.trim()
          : undefined
      nextDeliveryAddresses = normalizeDeliveryAddresses(parsed, undefined, {
        defaultId,
      })
    }

    let nextDelivery = customer.delivery
    if (body.deliveryAddresses !== undefined) {
      const def = getDefaultDeliveryAddress(nextDeliveryAddresses)
      if (!def) {
        nextDelivery = undefined
      } else {
        const base = customer.delivery ?? customer.billing
        nextDelivery = {
          firstName: def.firstName?.trim() || base.firstName,
          lastName: def.lastName?.trim() || base.lastName,
          street: def.street,
          zip: def.zip,
          city: def.city,
          country: base.country || "CH",
          email: nextBilling.email || base.email,
          phone: base.phone,
        }
      }
    } else if (body.delivery === null) {
      nextDelivery = undefined
    } else if (body.delivery !== undefined) {
      const parsed = parseOrderAddress(
        body.delivery,
        customer.delivery ?? customer.billing
      )
      if (parsed) {
        nextDelivery = parsed
        const existingDefault =
          nextDeliveryAddresses.find((a) => a.isDefault) ??
          nextDeliveryAddresses[0]
        const upserted: SavedDeliveryAddress = {
          id: existingDefault?.id ?? `crm-${Date.now()}`,
          label: existingDefault?.label ?? "Lieferadresse",
          street: parsed.street,
          zip: parsed.zip,
          city: parsed.city,
          isDefault: true,
        }
        nextDeliveryAddresses = normalizeDeliveryAddresses(
          nextDeliveryAddresses.length === 0
            ? [upserted]
            : nextDeliveryAddresses.map((a) =>
                a.id === upserted.id ? upserted : { ...a, isDefault: false }
              ),
          undefined,
          { defaultId: upserted.id }
        )
      }
    }

    let nextEmail = customer.email
    if (typeof body.email === "string" && body.email.trim()) {
      nextEmail = normalizeCustomerEmail(body.email)
    } else {
      nextEmail = normalizeCustomerEmail(nextBilling.email || customer.email)
    }

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
      deliveryAddresses: nextDeliveryAddresses,
      status: nextStatus,
      customerCategoryId: nextCategoryId,
    }

    // Portal-Konto zuerst spiegeln — Lieferadressen dürfen nie an CRM-Fehlern scheitern.
    const portalAccount = await findLinkedPortalAccount(customer)
    if (portalAccount) {
      const legacy = legacyFieldsFromDeliveryAddresses(nextDeliveryAddresses, {
        street: nextBilling.street,
        zip: nextBilling.zip,
        city: nextBilling.city,
      })
      await saveAccount({
        ...portalAccount,
        email: nextEmail,
        firstName: nextBilling.firstName,
        lastName: nextBilling.lastName,
        phone: nextBilling.phone || portalAccount.phone,
        street: nextBilling.street || portalAccount.street,
        zip: nextBilling.zip || portalAccount.zip,
        city: nextBilling.city || portalAccount.city,
        deliveryStreet: legacy.deliveryStreet ?? "",
        deliveryZip: legacy.deliveryZip ?? "",
        deliveryCity: legacy.deliveryCity ?? "",
        deliverySameAsBilling:
          nextDeliveryAddresses.length === 0
            ? true
            : Boolean(legacy.deliverySameAsBilling),
        deliveryAddresses: nextDeliveryAddresses,
        status: nextStatus,
        customerCategoryId: nextCategoryId,
      })
    }

    let saved = updated
    let crmSaveFailed = false
    try {
      saved = await saveCustomer(updated)
    } catch (error) {
      crmSaveFailed = true
      console.warn(
        "Admin-API: CRM-Kunde konnte nicht gespeichert werden — Portal-Spiegelung bleibt erhalten.",
        error
      )
      if (!portalAccount) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Kunde konnte nicht gespeichert werden.",
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      customer: {
        ...withNormalizedDeliveryAddresses(saved),
        // Auch bei CRM-Fehler die gewünschte Kategorie zurückgeben (Portal/Optimistic).
        customerCategoryId: nextCategoryId ?? saved.customerCategoryId ?? null,
        name: customerDisplayName(saved.billing),
        status: nextStatus,
      },
      ...(crmSaveFailed
        ? {
            warning:
              "CRM-Speichern fehlgeschlagen — Kategorie am Portal-Konto gespeichert.",
          }
        : {}),
    })
  } catch (error) {
    console.warn("Admin-API: Kunde konnte nicht aktualisiert werden.", error)
    return NextResponse.json(
      { error: "Kunde konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }
}
