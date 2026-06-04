import { NextResponse } from "next/server"
import { getOrdersForCustomerEmail } from "@/lib/konto/customer-orders"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"

export async function GET() {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  try {
    const orders = await getOrdersForCustomerEmail(email)
    return NextResponse.json({ orders })
  } catch (error) {
    console.error("Konto: Bestellungen konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Bestellungen konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}
