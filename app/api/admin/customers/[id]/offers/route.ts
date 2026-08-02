import { NextResponse } from "next/server"
import { getCustomerByNumber } from "@/lib/admin/db"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import {
  getOffersForCustomer,
  saveCustomerOffer,
} from "@/lib/konto/offers-db"
import {
  normalizeCustomerOffer,
  type CustomerOffer,
} from "@/lib/konto/customer-offer-types"
import type { CartItem } from "@/lib/dripforge/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const customer = await getCustomerByNumber(decodeURIComponent(id))
    if (!customer) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 })
    }

    const offers = await getOffersForCustomer(customer.email)
    return NextResponse.json({ offers })
  } catch (error) {
    console.warn("Admin-API: Angebote konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Angebote konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const customer = await getCustomerByNumber(decodeURIComponent(id))
    if (!customer) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 })
    }

    let body: {
      title?: unknown
      description?: unknown
      previewUrl?: unknown
      priceChf?: unknown
      cartItem?: unknown
      status?: unknown
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 })
    }

    const title =
      typeof body.title === "string" ? body.title.trim() : ""
    if (!title) {
      return NextResponse.json(
        { error: "Titel ist erforderlich." },
        { status: 400 }
      )
    }

    const cartItem =
      body.cartItem && typeof body.cartItem === "object"
        ? (body.cartItem as CartItem)
        : null
    if (!cartItem) {
      return NextResponse.json(
        { error: "cartItem ist erforderlich." },
        { status: 400 }
      )
    }

    const priceChf =
      body.priceChf != null && Number.isFinite(Number(body.priceChf))
        ? Number(body.priceChf)
        : Number(cartItem.price)

    const offer = normalizeCustomerOffer({
      customerEmail: normalizeCustomerEmail(customer.email),
      customerId: customer.kundennummer,
      title,
      description:
        typeof body.description === "string" ? body.description : undefined,
      previewUrl:
        typeof body.previewUrl === "string" ? body.previewUrl : null,
      priceChf: Number.isFinite(priceChf) ? priceChf : null,
      cartItem: {
        ...cartItem,
        name: cartItem.name || title,
        price:
          Number.isFinite(Number(cartItem.price)) && Number(cartItem.price) > 0
            ? Number(cartItem.price)
            : Number.isFinite(priceChf)
              ? priceChf
              : 0,
        quantity: Math.max(1, Number(cartItem.quantity) || 1),
        type: cartItem.type === "laser" ? "laser" : "3d",
      },
      status:
        body.status === "accepted" ||
        body.status === "expired" ||
        body.status === "withdrawn"
          ? body.status
          : "active",
      createdByAdmin: auth.userId,
    } as Partial<CustomerOffer>)

    if (!offer) {
      return NextResponse.json(
        { error: "Ungültiges Angebot." },
        { status: 400 }
      )
    }

    const saved = await saveCustomerOffer(offer)
    return NextResponse.json({ offer: saved }, { status: 201 })
  } catch (error) {
    console.warn("Admin-API: Angebot konnte nicht erstellt werden.", error)
    return NextResponse.json(
      { error: "Angebot konnte nicht erstellt werden." },
      { status: 500 }
    )
  }
}
