import { NextResponse } from "next/server"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { getOrdersForCustomerEmail } from "@/lib/konto/customer-orders"
import { getProducts } from "@/lib/admin/db"

export const dynamic = "force-dynamic"

/** Produkte, die der Kunde früher bestellt hat — für schnelle Nachbestellung. */
export async function GET() {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  try {
    const [orders, products] = await Promise.all([
      getOrdersForCustomerEmail(email),
      getProducts(),
    ])
    const byId = new Map(products.map((p) => [p.id, p]))
    const seen = new Map<
      string,
      {
        productId: string
        name: string
        type: "3d" | "laser"
        price: number
        imageUrl: string | null
        lastOrderedAt: string
        orderCount: number
      }
    >()

    for (const order of orders) {
      for (const item of order.items) {
        // Bestellpositionen haben oft synthetische IDs — Match über Name + Typ.
        const catalog =
          byId.get(item.id) ||
          products.find(
            (p) =>
              p.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
              p.type === item.type
          )
        const key = catalog?.id ?? `name:${item.type}:${item.name.trim().toLowerCase()}`
        const existing = seen.get(key)
        if (existing) {
          existing.orderCount += 1
          if (new Date(order.createdAt) > new Date(existing.lastOrderedAt)) {
            existing.lastOrderedAt = order.createdAt
          }
          continue
        }
        seen.set(key, {
          productId: catalog?.id ?? item.id,
          name: catalog?.name ?? item.name,
          type: item.type,
          price: catalog?.price ?? item.unitPriceChf,
          imageUrl:
            catalog?.images?.[0] ??
            item.imageUrl ??
            item.mockupPreviewUrl ??
            null,
          lastOrderedAt: order.createdAt,
          orderCount: 1,
        })
      }
    }

    const suggestions = [...seen.values()].sort(
      (a, b) =>
        new Date(b.lastOrderedAt).getTime() - new Date(a.lastOrderedAt).getTime()
    )

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("Konto Bestellvorschlag fehlgeschlagen.", error)
    return NextResponse.json({ suggestions: [] })
  }
}
