import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import { getAccountByEmail } from "@/lib/konto/account-db"
import { findCustomerCategory } from "@/lib/dripforge/customer-categories"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Auflösung der Kundenkategorie (Rabatt/Versand) für die aktuelle Session.
 * Liefert `category: null`, wenn nicht eingeloggt oder keine Kategorie zugeordnet.
 */
export async function GET() {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ category: null }, { headers: noStore })
  }

  const [account, settings] = await Promise.all([
    getAccountByEmail(email),
    getSettings(),
  ])
  const category = findCustomerCategory(
    settings.customerCategories,
    account?.customerCategoryId
  )
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
