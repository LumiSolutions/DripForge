import { NextResponse } from "next/server"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { getOfferById, saveCustomerOffer } from "@/lib/konto/offers-db"
import { normalizeCustomerEmail } from "@/lib/admin/customers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const offer = await getOfferById(decodeURIComponent(id))
    if (!offer) {
      return NextResponse.json(
        { error: "Angebot nicht gefunden." },
        { status: 404 }
      )
    }

    if (
      normalizeCustomerEmail(offer.customerEmail) !==
      normalizeCustomerEmail(email)
    ) {
      return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 })
    }

    if (offer.status !== "active") {
      return NextResponse.json(
        { error: "Angebot ist nicht mehr aktiv.", cartItem: offer.cartItem },
        { status: 400 }
      )
    }

    let markAccepted = true
    try {
      const body = (await request.json()) as { markAccepted?: unknown }
      if (body.markAccepted === false) markAccepted = false
    } catch {
      /* optional body */
    }

    if (markAccepted) {
      await saveCustomerOffer({
        ...offer,
        status: "accepted",
        updatedAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      ok: true,
      cartItem: offer.cartItem,
      offerId: offer.id,
    })
  } catch (error) {
    console.error("Konto Offer accept fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Angebot konnte nicht übernommen werden." },
      { status: 500 }
    )
  }
}
