"use client"

import { cn } from "@/lib/utils"

type DiscountedUnitPriceProps = {
  /** Endpreis (nach Sale/Mengen- + Kategorie-Rabatt). */
  unitPrice: number
  /** Preis vor Kundenkategorie (nach Sale/Mengenrabatt). */
  preCategoryPrice: number
  /** Optional: UVP / Listenpreis vor Produktrabatt. */
  listPrice?: number
  /** Optional: Preis vor Mengenrabatt (nach Sale). */
  baseUnitPrice?: number
  categoryDiscountPercent?: number
  quantityDiscountPercent?: number
  categoryName?: string | null
  size?: "sm" | "lg"
  className?: string
}

/**
 * Einheitliche Preiszeile: fetter Nettopreis + Strike (bevorzugt UVP).
 * Kategorie-Rabatt stapelt auf Sale-/Mengenrabatt.
 */
export function DiscountedUnitPrice({
  unitPrice,
  preCategoryPrice,
  listPrice,
  baseUnitPrice,
  categoryDiscountPercent = 0,
  quantityDiscountPercent = 0,
  categoryName,
  size = "lg",
  className,
}: DiscountedUnitPriceProps) {
  const hasCategory =
    categoryDiscountPercent > 0 && preCategoryPrice > unitPrice + 0.001
  const hasQty =
    quantityDiscountPercent > 0 &&
    baseUnitPrice != null &&
    baseUnitPrice > preCategoryPrice + 0.001

  // Strike: UVP wenn vorhanden und höher, sonst vor Kategorie, sonst vor Menge.
  const strikeCandidates = [
    listPrice != null && listPrice > unitPrice + 0.001 ? listPrice : null,
    hasCategory ? preCategoryPrice : null,
    hasQty ? baseUnitPrice! : null,
  ].filter((v): v is number => v != null && v > unitPrice + 0.001)

  const strike =
    strikeCandidates.length > 0 ? Math.max(...strikeCandidates) : null

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p
        className={cn(
          "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-bold tabular-nums",
          size === "lg" ? "text-2xl text-primary" : "text-lg"
        )}
      >
        <span>CHF {unitPrice.toFixed(2)}</span>
        {strike != null ? (
          <span
            className={cn(
              "font-normal text-muted-foreground line-through",
              size === "lg" ? "text-base" : "text-sm"
            )}
          >
            CHF {strike.toFixed(2)}
          </span>
        ) : null}
        {hasCategory ? (
          <span
            className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
            title={categoryName ? `Kundenrabatt: ${categoryName}` : undefined}
          >
            −{categoryDiscountPercent.toFixed(0)}%
          </span>
        ) : null}
      </p>
    </div>
  )
}
