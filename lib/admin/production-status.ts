import type { ProductionStatus, StoredOrder } from "@/lib/admin/types"

export const PRODUCTION_COLUMNS: {
  id: ProductionStatus
  label: string
  hint: string
}[] = [
  {
    id: "bestellungseingang",
    label: "Bestellungseingang",
    hint: "Neu — Rechnung/TWINT bis Zahlungseingang",
  },
  {
    id: "bezahlt",
    label: "Bezahlt",
    hint: "Zahlung bestätigt — bereit zur Freigabe",
  },
  {
    id: "bereit_fuer_produktion",
    label: "Bereit für Produktion",
    hint: "Freigegebene, personalisierte Aufträge",
  },
  {
    id: "in_produktion",
    label: "In Produktion",
    hint: "Aktiv in der Werkstatt",
  },
  {
    id: "qualitaetskontrolle",
    label: "Qualitätskontrolle",
    hint: "Prüfung vor Versand",
  },
  {
    id: "bereit_fuer_versand",
    label: "Bereit für Versand",
    hint: "Verpackung & Versand",
  },
  {
    id: "versendet",
    label: "Versendet",
    hint: "Unterwegs zur Kundschaft",
  },
]

const VALID: ProductionStatus[] = PRODUCTION_COLUMNS.map((c) => c.id)

export function isProductionStatus(value: string): value is ProductionStatus {
  return (VALID as string[]).includes(value)
}

/** Legacy-Bestellungen ohne productionStatus aus Shop-/Zahlungsstatus ableiten. */
export function resolveProductionStatus(order: StoredOrder): ProductionStatus {
  if (order.status === "versendet") return "versendet"
  if (order.productionStatus && isProductionStatus(order.productionStatus)) {
    return order.productionStatus
  }
  if (order.status === "in_produktion") return "in_produktion"
  const paid = order.paymentConfirmed === true || order.paymentStatus === "paid"
  return paid ? "bezahlt" : "bestellungseingang"
}

/** Zahlung bestätigt? (paymentConfirmed oder abgeleitetes paymentStatus). */
export function isOrderPaid(order: StoredOrder): boolean {
  return order.paymentConfirmed === true || order.paymentStatus === "paid"
}

/**
 * Manuelle Zahlungsbestätigung nötig? (Rechnung/TWINT, noch nicht bezahlt).
 * Kreditkarte/Stripe wird automatisch nach dem Webhook bestätigt.
 */
export function needsManualPaymentConfirmation(order: StoredOrder): boolean {
  if (isOrderPaid(order)) return false
  return (
    order.paymentMethod === "invoice" ||
    order.paymentMethod === "twint" ||
    order.paymentMethod === "cash"
  )
}

export function productionStatusLabel(status: ProductionStatus): string {
  return PRODUCTION_COLUMNS.find((c) => c.id === status)?.label ?? status
}

export function nextProductionStatus(
  current: ProductionStatus
): ProductionStatus | null {
  const index = PRODUCTION_COLUMNS.findIndex((c) => c.id === current)
  if (index < 0 || index >= PRODUCTION_COLUMNS.length - 1) return null
  return PRODUCTION_COLUMNS[index + 1].id
}

export function prevProductionStatus(
  current: ProductionStatus
): ProductionStatus | null {
  const index = PRODUCTION_COLUMNS.findIndex((c) => c.id === current)
  if (index <= 0) return null
  return PRODUCTION_COLUMNS[index - 1].id
}

export function isOrderVisibleInProductionCockpit(order: StoredOrder): boolean {
  return order.status !== "storniert"
}

export function requiresShipmentModal(
  from: ProductionStatus,
  to: ProductionStatus
): boolean {
  return from === "bereit_fuer_versand" && to === "versendet"
}

export function normalizeTrackingNumber(value: string): string {
  return value.trim().replace(/\s+/g, "")
}

export function isValidTrackingNumber(value: string): boolean {
  const normalized = normalizeTrackingNumber(value)
  return normalized.length >= 8
}
