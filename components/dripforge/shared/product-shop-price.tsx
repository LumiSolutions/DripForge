"use client"

import { cn } from "@/lib/utils"
import type { Product } from "@/lib/dripforge/types"
import { useCustomerCategory } from "@/components/dripforge/customer-category-provider"

type ProductShopPriceProps = {
  product: Product
  size?: "sm" | "lg"
  className?: string
}

/**
 * Shop-Kartenpreis: Sale-Preis als Basis, dann Kundenkategorie-Rabatt.
 * Beispiel: CHF 20 → Sale 10% = 18 → Kategorie −50% = **9.00** ~~18.00~~
 */
export function ProductShopPrice({
  product,
  size = "sm",
  className,
}: ProductShopPriceProps) {
  const { discountPercent, applyDiscount, category, loaded } =
    useCustomerCategory()
  const price = Number.isFinite(product.price) ? product.price : 0
  const original =
    product.originalPrice != null && Number.isFinite(product.originalPrice)
      ? product.originalPrice
      : null
  const onSale = Boolean(product.sale) && original != null && original > price

  const hasCategoryDiscount = discountPercent > 0 && price > 0
  // Vor erstem Fetch keinen Rabatt vortäuschen; danach Kategorie behalten.
  const effectivePrice =
    loaded && hasCategoryDiscount ? applyDiscount(price) : price
  // Strike: vor Kategorie (inkl. Sale), sonst Sale-Original.
  const strikePrice =
    loaded && hasCategoryDiscount
      ? price
      : onSale
        ? original
        : null

  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span
        className={cn(
          "font-bold tabular-nums",
          size === "lg" ? "text-2xl sm:text-3xl" : "text-lg",
          (onSale || (loaded && hasCategoryDiscount)) && "text-red-400"
        )}
      >
        CHF {effectivePrice.toFixed(2)}
      </span>
      {strikePrice != null && strikePrice > effectivePrice + 0.001 && (
        <span
          className={cn(
            "text-muted-foreground line-through tabular-nums",
            size === "lg" ? "text-lg" : "text-sm"
          )}
        >
          CHF {strikePrice.toFixed(2)}
        </span>
      )}
      {loaded && hasCategoryDiscount && (
        <span
          className={cn(
            "rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300",
            size === "lg" ? "text-xs" : "text-[10px]"
          )}
          title={category?.name ? `Kundenrabatt: ${category.name}` : undefined}
        >
          −{discountPercent}%
        </span>
      )}
    </div>
  )
}
