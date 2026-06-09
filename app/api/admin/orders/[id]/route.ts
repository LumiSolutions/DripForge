import { NextResponse } from "next/server"
import {
  getOrderById,
  updateOrderProductionStatus,
  updateOrderStatus,
} from "@/lib/admin/db"
import { isProductionStatus } from "@/lib/admin/production-status"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { OrderStatus } from "@/lib/admin/types"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

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
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const body = (await request.json()) as {
      status?: OrderStatus
      productionStatus?: string
    }

    if (body.productionStatus) {
      if (!isProductionStatus(body.productionStatus)) {
        return NextResponse.json(
          { error: "Ungueltiger Produktionsstatus." },
          { status: 400 }
        )
      }
      const order = await updateOrderProductionStatus(id, body.productionStatus)
      if (!order) {
        return NextResponse.json(
          { error: "Bestellung nicht gefunden." },
          { status: 404 }
        )
      }
      return NextResponse.json({ order })
    }

    if (!body.status) {
      return NextResponse.json(
        { error: "Status oder productionStatus fehlt." },
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
