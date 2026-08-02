import { NextResponse } from "next/server"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { getActiveOffersForCustomer } from "@/lib/konto/offers-db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  try {
    const offers = await getActiveOffersForCustomer(email)
    return NextResponse.json({ offers })
  } catch (error) {
    console.error("Konto Offers GET fehlgeschlagen.", error)
    return NextResponse.json({ offers: [] })
  }
}
