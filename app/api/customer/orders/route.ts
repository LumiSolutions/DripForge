import { NextResponse } from "next/server"
import { getOrdersForCustomerEmail } from "@/lib/konto/customer-orders"
import {
  isCustomerAuthError,
  requireCustomerSession,
} from "@/lib/konto/customer-api-auth"

export async function GET() {
  const auth = await requireCustomerSession()
  if (isCustomerAuthError(auth)) return auth

  try {
    const orders = await getOrdersForCustomerEmail(auth.email)
    return NextResponse.json({ orders })
  } catch (error) {
    console.error("Customer-API: Bestellungen konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Bestellungen konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}
