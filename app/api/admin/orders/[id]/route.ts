import { NextResponse } from "next/server"
import {
  getOrderById,
  updateOrderProductionStatus,
} from "@/lib/admin/db"
import {
  HardDeleteOrderError,
  hardDeleteOrder,
} from "@/lib/admin/hard-delete-order"
import { updateOrderStatusWithInventory } from "@/lib/admin/order-inventory-hook"
import { isProductionStatus } from "@/lib/admin/production-status"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { CosmosDatabaseError } from "@/lib/admin/storage-bridge"
import { maybeNotifyOrderStatusChange } from "@/lib/email/order-notifications"
import { syncOrderStatusSideEffects } from "@/lib/admin/order-status-sync"
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
    const existing = await getOrderById(id)
    if (!existing) {
      return NextResponse.json(
        { error: "Bestellung nicht gefunden." },
        { status: 404 }
      )
    }

    const body = (await request.json()) as {
      status?: OrderStatus
      productionStatus?: string
    }

    if (body.productionStatus) {
      if (!isProductionStatus(body.productionStatus)) {
        return NextResponse.json(
          { error: "Ungültiger Produktionsstatus." },
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
      const emailSent = await maybeNotifyOrderStatusChange(existing, order)
      await syncOrderStatusSideEffects(order)
      return NextResponse.json({ order, emailSent })
    }

    if (!body.status) {
      return NextResponse.json(
        { error: "Status oder productionStatus fehlt." },
        { status: 400 }
      )
    }
    const order = await updateOrderStatusWithInventory(id, body.status)
    if (!order) {
      return NextResponse.json(
        { error: "Bestellung nicht gefunden." },
        { status: 404 }
      )
    }
    const emailSent = await maybeNotifyOrderStatusChange(existing, order)
    await syncOrderStatusSideEffects(order)
    return NextResponse.json({ order, emailSent })
  } catch (error) {
    console.warn("Admin-API: Status konnte nicht aktualisiert werden.", error)
    return NextResponse.json(
      { error: "Status konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    await hardDeleteOrder(id)
    return NextResponse.json({ success: true, orderId: id })
  } catch (error) {
    if (error instanceof HardDeleteOrderError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof CosmosDatabaseError) {
      return NextResponse.json(
        { error: "Bestelldatenbank nicht erreichbar." },
        { status: 503 }
      )
    }
    console.warn("Admin-API: Bestellung konnte nicht gelöscht werden.", error)
    return NextResponse.json(
      { error: "Bestellung konnte nicht gelöscht werden." },
      { status: 500 }
    )
  }
}
