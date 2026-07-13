import { ZERO_VAT_AMOUNT_TAX_CODES } from "@/lib/accounting/tax-code-seed"
import type { TaxCode } from "@/lib/accounting/tax-code-types"

function roundChf(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatTaxCodePercent(rate: number): string {
  const percent = rate * 100
  if (percent === 0) return "0.0%"
  const formatted = percent.toFixed(1).replace(/\.0$/, "")
  return `${formatted}%`
}

/** Anzeige im Dropdown: "VM81 - Vorsteuer Material 8.1% (8.1%)" */
export function formatTaxCodeOptionLabel(taxCode: TaxCode): string {
  return `${taxCode.code} - ${taxCode.name} (${formatTaxCodePercent(taxCode.rate)})`
}

export function isZeroVatAmountTaxCode(code: string): boolean {
  return ZERO_VAT_AMOUNT_TAX_CODES.has(code.trim().toUpperCase())
}

export function resolveTaxRateFromCode(
  taxCode: string | undefined,
  taxCodes: TaxCode[]
): number {
  if (!taxCode?.trim()) return 0
  const match = taxCodes.find(
    (item) => item.code.toUpperCase() === taxCode.trim().toUpperCase()
  )
  return match?.rate ?? 0
}

/** MWST-Betrag aus Nettobetrag und Steuersatz (für Anzeige in der Buchungsmaske). */
export function computeVatAmount(
  netAmount: number,
  rate: number,
  taxCode?: string
): number {
  if (isZeroVatAmountTaxCode(taxCode ?? "")) return 0
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return roundChf(netAmount * rate)
}

export function sortTaxCodes(taxCodes: TaxCode[]): TaxCode[] {
  return [...taxCodes].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.code.localeCompare(b.code, "de-CH")
  })
}

export function activeTaxCodes(taxCodes: TaxCode[]): TaxCode[] {
  return sortTaxCodes(taxCodes.filter((item) => item.isActive))
}
