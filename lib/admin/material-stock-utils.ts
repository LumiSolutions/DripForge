import {
  GRAMS_PER_FULL_SPOOL,
  type MaterialStockUnit,
} from "@/lib/admin/material-types"

export type GramStockDisplay = {
  totalGrams: number
  fullRolls: number
  partialGrams: number
  label: string
  partialLabel: string | null
}

/** Filament-Bestand in «X Rollen (voll) + Yg (angefangen)» umrechnen */
export function formatGramStockDisplay(totalGrams: number): GramStockDisplay {
  const total = Math.max(0, Math.round(totalGrams))
  const fullRolls = Math.floor(total / GRAMS_PER_FULL_SPOOL)
  const partialGrams = total % GRAMS_PER_FULL_SPOOL

  const parts: string[] = []
  if (fullRolls > 0) {
    parts.push(`${fullRolls} Rolle${fullRolls === 1 ? "" : "n"} (voll)`)
  }
  if (partialGrams > 0) {
    parts.push(`${partialGrams}g (angefangen)`)
  }
  if (parts.length === 0) {
    parts.push("0g")
  }

  let partialLabel: string | null = null
  if (partialGrams > 0 && partialGrams < GRAMS_PER_FULL_SPOOL) {
    partialLabel =
      fullRolls > 0
        ? "Teilmenge"
        : partialGrams < GRAMS_PER_FULL_SPOOL
          ? "1 Rolle angefangen"
          : null
  }

  return {
    totalGrams: total,
    fullRolls,
    partialGrams,
    label: parts.join(" + "),
    partialLabel,
  }
}

export function formatStockForUnit(
  amount: number,
  unit: MaterialStockUnit
): string {
  if (unit === "gram") {
    return formatGramStockDisplay(amount).label
  }
  return `${Math.round(amount).toLocaleString("de-CH")} Stk.`
}

export function addFullRollsToGrams(rolls: number): number {
  return Math.max(0, Math.round(rolls)) * GRAMS_PER_FULL_SPOOL
}
