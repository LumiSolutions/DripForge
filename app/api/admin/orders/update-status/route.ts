import { NextResponse } from "next/server"
import { completeOrderShipment } from "@/lib/admin/complete-order-shipment"
import {
  getOrderById,
  getSettings,
  updateOrderProductionStatus,
  updateOrderShipmentDetails,
} from "@/lib/admin/db"
import { updateOrderStatusWithInventory } from "@/lib/admin/order-inventory-hook"
import {
  isProductionStatus,
  isValidTrackingNumber,
  normalizeTrackingNumber,
} from "@/lib/admin/production-status"
import { confirmOrderPaymentManually } from "@/lib/shop/confirm-order-payment"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import {
  maybeNotifyOrderStatusChange,
  notifyOrderShipped,
} from "@/lib/email/order-notifications"
import type { OrderStatus, ProductionStatus } from "@/lib/admin/types"

type UpdateStatusBody = {
  orderId?: string
  status?: OrderStatus
  productionStatus?: ProductionStatus
  trackingNumber?: string
  /** Manuelle Zahlungsbestätigung (Rechnung/TWINT/Bar). */
  confirmPayment?: boolean
  /** Bank Raiffeisen oder Bar/Kasse — für Rechnung/Bar. */
  settlementAccount?: "bank" | "cash"
  /** Effektives Zahlungsdatum (YYYY-MM-DD). */
  paymentDate?: string
}

export async function PATCH(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json()) as UpdateStatusBody
    const orderId = body.orderId?.trim()

    if (!orderId) {
      return NextResponse.json({ error: "orderId fehlt." }, { status: 400 })
    }

    const existing = await getOrderById(orderId)
    if (!existing) {
      return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 })
    }

    if (body.confirmPayment) {
      const result = await confirmOrderPaymentManually(orderId, {
        settlementAccount:
          body.settlementAccount === "bank" || body.settlementAccount === "cash"
            ? body.settlementAccount
            : undefined,
        paymentDate:
          typeof body.paymentDate === "string" ? body.paymentDate.trim() : undefined,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({
        order: result.order,
        alreadyConfirmed: result.alreadyConfirmed,
      })
    }

    if (body.status === "versendet" || body.productionStatus === "versendet") {
      const tracking = body.trackingNumber ?? existing.trackingNumber ?? ""
      if (!isValidTrackingNumber(tracking)) {
        return NextResponse.json(
          { error: "Bitte eine gültige Schweizer Post Sendungsnummer angeben." },
          { status: 400 }
        )
      }

      const result = await completeOrderShipment(orderId, tracking)
      if (!result) {
        return NextResponse.json(
          { error: "Versand konnte nicht abgeschlossen werden." },
          { status: 400 }
        )
      }

      const settings = await getSettings()
      const emailSent = await notifyOrderShipped(result.order, settings)

      return NextResponse.json({
        order: result.order,
        emailSent,
      })
    }

    if (body.productionStatus) {
      if (!isProductionStatus(body.productionStatus)) {
        return NextResponse.json(
          { error: "Ungültiger Produktionsstatus." },
          { status: 400 }
        )
      }
      const order = await updateOrderProductionStatus(orderId, body.productionStatus)
      if (!order) {
        return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 })
      }
      const emailSent = await maybeNotifyOrderStatusChange(existing, order)
      return NextResponse.json({ order, emailSent })
    }

    if (body.status) {
      const order = await updateOrderStatusWithInventory(orderId, body.status)
      if (!order) {
        return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 })
      }
      const emailSent = await maybeNotifyOrderStatusChange(existing, order)
      return NextResponse.json({ order, emailSent })
    }

    if (body.trackingNumber != null) {
      const normalized = normalizeTrackingNumber(body.trackingNumber)
      const order = await updateOrderShipmentDetails(orderId, {
        trackingNumber: normalized || undefined,
      })
      if (!order) {
        return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 })
      }
      return NextResponse.json({ order })
    }

    return NextResponse.json({ error: "Keine Statusänderung angegeben." }, { status: 400 })
  } catch (error) {
    console.warn("Admin-API: update-status fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Status konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }
}
