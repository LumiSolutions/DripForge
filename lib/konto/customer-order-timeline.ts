import type { StoredOrder } from "@/lib/admin/types"
import { normalizeTrackingNumber } from "@/lib/admin/production-status"

export function swissPostTrackingUrl(trackingNumber: string): string {
  const keyword = normalizeTrackingNumber(trackingNumber)
  return `https://www.post.ch/de/pages/sendungsnachverfolgung?keyword=${encodeURIComponent(keyword)}`
}

export const CUSTOMER_ORDER_TIMELINE_STEPS = [
  {
    id: "bereit_fuer_produktion",
    label: "Bestellt / Bereit für Produktion",
  },
  {
    id: "in_produktion",
    label: "In Produktion",
  },
  {
    id: "qualitaetskontrolle",
    label: "Qualitätskontrolle",
  },
  {
    id: "bereit_fuer_versand",
    label: "Bereit für Versand / Verpackt",
  },
  {
    id: "versendet",
    label: "Versendet",
  },
] as const

export type CustomerTimelineStepId =
  (typeof CUSTOMER_ORDER_TIMELINE_STEPS)[number]["id"]

const STEP_INDEX: Record<CustomerTimelineStepId, number> = {
  bereit_fuer_produktion: 0,
  in_produktion: 1,
  qualitaetskontrolle: 2,
  bereit_fuer_versand: 3,
  versendet: 4,
}

export function resolveCustomerTimelineStepIndex(order: {
  status: StoredOrder["status"]
  productionStatus?: StoredOrder["productionStatus"]
}): number {
  if (order.status === "storniert") return 0
  if (order.status === "versendet" || order.productionStatus === "versendet") {
    return STEP_INDEX.versendet
  }

  const production = order.productionStatus
  if (production && production in STEP_INDEX) {
    return STEP_INDEX[production as CustomerTimelineStepId]
  }

  if (order.status === "in_produktion") return STEP_INDEX.in_produktion
  return STEP_INDEX.bereit_fuer_produktion
}

export function resolveCustomerTrackingUrl(
  order: Pick<StoredOrder, "status" | "trackingNumber">
): string | null {
  if (order.status !== "versendet" || !order.trackingNumber?.trim()) return null
  return swissPostTrackingUrl(order.trackingNumber)
}
