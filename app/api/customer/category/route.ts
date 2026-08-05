import { NextResponse } from "next/server"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { resolveCustomerCategoryForEmail } from "@/lib/konto/resolve-customer-category"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Auflösung der Kundenkategorie (Rabatt/Versand) für die aktuelle Session.
 * Liefert `category: null`, wenn nicht eingeloggt oder keine Kategorie zugeordnet.
 * Quellen: Portal-Konto und CRM (Fallback), damit Admin-Zuordnung im Shop greift.
 */
export async function GET() {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ category: null }, { headers: noStore })
  }

  const category = await resolveCustomerCategoryForEmail(email)
  if (!category) {
    return NextResponse.json({ category: null }, { headers: noStore })
  }

  return NextResponse.json(
    {
      category: {
        id: category.id,
        name: category.name,
        discountPercent: category.discountPercent,
        allowedShippingMethodIds: category.allowedShippingMethodIds,
        allowedPaymentMethodIds: category.allowedPaymentMethodIds,
      },
    },
    { headers: noStore }
  )
}

const noStore = { "Cache-Control": "no-store, max-age=0" }
