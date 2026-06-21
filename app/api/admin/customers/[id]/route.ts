import { NextResponse } from "next/server"
import { getCustomerByNumber, getOrderById } from "@/lib/admin/db"
import { customerDisplayName, normalizeCustomerEmail } from "@/lib/admin/customers"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { listAllAccounts } from "@/lib/konto/account-db"
import { normalizeAccountStatus } from "@/lib/konto/account-status"

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

    return NextResponse.json({
      customer: {
        ...customer,
        name: customerDisplayName(customer.billing),
        status,
      },
      orders,
    })
  } catch (error) {
    console.warn("Admin-API: Kunde konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Kunde konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}
