import { NextResponse } from "next/server"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import {
  getAccountCartItems,
  replaceCustomerCart,
} from "@/lib/konto/cart-service"

export async function GET() {
  try {
    const email = await getSessionEmailFromRequest()
    if (!email) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
    }

    const items = await getAccountCartItems(email)
    return NextResponse.json({ items })
  } catch (error) {
    console.error("Konto: Warenkorb laden fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Warenkorb konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const email = await getSessionEmailFromRequest()
    if (!email) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
    }

    const body = (await request.json()) as { items?: unknown }
    const items = await replaceCustomerCart(email, body.items ?? [])
    return NextResponse.json({ items })
  } catch (error) {
    console.error("Konto: Warenkorb speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Warenkorb konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
