import type { ProductionStatus, StoredOrder } from "@/lib/admin/types"

export const PRODUCTION_COLUMNS: {
  id: ProductionStatus
  label: string
  hint: string
}[] = [
  {
    id: "bereit_fuer_produktion",
    label: "Bereit für Produktion",
    hint: "Neue, personalisierte Aufträge",
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
]

const VALID: ProductionStatus[] = PRODUCTION_COLUMNS.map((c) => c.id)

export function isProductionStatus(value: string): value is ProductionStatus {
  return (VALID as string[]).includes(value)
}

/** Legacy-Bestellungen ohne productionStatus aus Shop-Status ableiten. */
export function resolveProductionStatus(order: StoredOrder): ProductionStatus {
  if (order.productionStatus && isProductionStatus(order.productionStatus)) {
    return order.productionStatus
  }
  switch (order.status) {
    case "in_produktion":
      return "in_produktion"
    case "versendet":
      return "bereit_fuer_versand"
    default:
      return "bereit_fuer_produktion"
  }
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
  return order.status !== "storniert" && order.status !== "versendet"
}
