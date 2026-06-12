import { NextResponse } from "next/server"
import { getCustomerByNumber, getOrderById } from "@/lib/admin/db"
import { customerDisplayName } from "@/lib/admin/customers"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { getAccountByEmail } from "@/lib/konto/account-db"
import { normalizeAiCredits } from "@/lib/konto/ai-credits"

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
      },
      orders,
      portalAccount: await (async () => {
        const account = await getAccountByEmail(customer.email)
        if (!account) {
          return { registered: false as const, aiCredits: null }
        }
        return {
          registered: true as const,
          aiCredits: normalizeAiCredits(account.aiCredits),
        }
      })(),
    })
  } catch (error) {
    console.warn("Admin-API: Kunde konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Kunde konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}
