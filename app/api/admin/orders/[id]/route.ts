import { NextResponse } from "next/server"
import { getOrderById, updateOrderStatus } from "@/lib/admin/db"
import type { OrderStatus } from "@/lib/admin/types"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const order = await getOrderById(id)
    if (!order) {
      return NextResponse.json(
        { error: "Bestellung nicht gefunden." },
        { status: 404 }
      )
    }
    return NextResponse.json({ order })
  } catch (error) {
    console.warn("Admin-API: Bestellung konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Bestellung konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as { status?: OrderStatus }
    if (!body.status) {
      return NextResponse.json(
        { error: "Status fehlt." },
        { status: 400 }
      )
    }
    const order = await updateOrderStatus(id, body.status)
    if (!order) {
      return NextResponse.json(
        { error: "Bestellung nicht gefunden." },
        { status: 404 }
      )
    }
    return NextResponse.json({ order })
  } catch (error) {
    console.warn("Admin-API: Status konnte nicht aktualisiert werden.", error)
    return NextResponse.json(
      { error: "Status konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }
}
