import { NextResponse } from "next/server"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { getOrdersForCustomerEmail } from "@/lib/konto/customer-orders"
import { getProducts } from "@/lib/admin/db"
import { getDesignsForCustomer } from "@/lib/konto/designs-db"

export const dynamic = "force-dynamic"

type Suggestion = {
  productId: string
  name: string
  type: "3d" | "laser"
  price: number
  imageUrl: string | null
  lastOrderedAt: string
  orderCount: number
  hasDesign: boolean
  engravingText: string | null
  designPreviewUrl: string | null
  designConfig: Record<string, unknown> | null
  savedDesignId: string | null
  savedDesignLabel: string | null
}

/** Produkte, die der Kunde früher bestellt hat — für schnelle Nachbestellung. */
export async function GET() {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  try {
    const [orders, products, savedDesigns] = await Promise.all([
      getOrdersForCustomerEmail(email),
      getProducts(),
      getDesignsForCustomer(email).catch(() => []),
    ])
    const byId = new Map(products.map((p) => [p.id, p]))
    const seen = new Map<string, Suggestion>()

    for (const order of orders) {
      for (const item of order.items) {
        const catalog =
          byId.get(item.id) ||
          products.find(
            (p) =>
              p.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
              p.type === item.type
          )
        const key = catalog?.id ?? `name:${item.type}:${item.name.trim().toLowerCase()}`
        const existing = seen.get(key)
        const designPreview =
          item.mockupPreviewUrl ?? item.logoPreviewUrl ?? item.imageUrl ?? null
        const hasDesign = Boolean(item.canSaveDesign && item.designConfig)

        if (existing) {
          existing.orderCount += 1
          if (new Date(order.createdAt) > new Date(existing.lastOrderedAt)) {
            existing.lastOrderedAt = order.createdAt
            if (hasDesign) {
              existing.hasDesign = true
              existing.engravingText = item.engravingText
              existing.designPreviewUrl = designPreview
              existing.designConfig = item.designConfig
            }
            existing.imageUrl =
              catalog?.images?.[0] ??
              item.imageUrl ??
              item.mockupPreviewUrl ??
              existing.imageUrl
          }
          continue
        }

        const matchingSaved =
          savedDesigns.find((design) => {
            if (design.designType !== item.type && design.designType !== "other") {
              return false
            }
            const label = design.label.trim().toLowerCase()
            const productName = (catalog?.name ?? item.name).trim().toLowerCase()
            return label.includes(productName) || productName.includes(label)
          }) ?? null

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
          hasDesign: hasDesign || Boolean(matchingSaved),
          engravingText: item.engravingText,
          designPreviewUrl: designPreview ?? matchingSaved?.previewUrl ?? null,
          designConfig:
            item.designConfig ??
            (matchingSaved?.config as Record<string, unknown> | null) ??
            null,
          savedDesignId: matchingSaved?.id ?? null,
          savedDesignLabel: matchingSaved?.label ?? null,
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
