import { NextResponse } from "next/server"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import {
  getWishlistForCustomer,
  toggleWishlistProduct,
} from "@/lib/konto/wishlist-db"
import { getProducts } from "@/lib/admin/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  try {
    const wishlist = await getWishlistForCustomer(email)
    const products = await getProducts()
    const byId = new Map(products.map((p) => [p.id, p]))
    const items = wishlist.items
      .map((item) => {
        const product = byId.get(item.productId)
        if (!product) return null
        return {
          productId: item.productId,
          addedAt: item.addedAt,
          product: {
            id: product.id,
            name: product.name,
            type: product.type,
            price: product.price,
            images: product.images,
          },
        }
      })
      .filter(Boolean)

    return NextResponse.json({ items, updatedAt: wishlist.updatedAt })
  } catch (error) {
    console.error("Konto Wishlist GET fehlgeschlagen.", error)
    return NextResponse.json({ items: [] })
  }
}

export async function POST(request: Request) {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { productId?: string }
    const productId = body.productId?.trim()
    if (!productId) {
      return NextResponse.json({ error: "productId fehlt." }, { status: 400 })
    }

    const result = await toggleWishlistProduct(email, productId)
    return NextResponse.json({
      added: result.added,
      productIds: result.wishlist.items.map((item) => item.productId),
    })
  } catch (error) {
    console.error("Konto Wishlist POST fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Merkliste konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }
}
