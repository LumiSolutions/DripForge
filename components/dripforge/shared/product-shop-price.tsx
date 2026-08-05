"use client"

import { cn } from "@/lib/utils"
import type { Product } from "@/lib/dripforge/types"
import { useCustomerCategory } from "@/components/dripforge/customer-category-provider"
import { calculateProductPrice } from "@/lib/dripforge/calculate-product-price"

type ProductShopPriceProps = {
  product: Product
  size?: "sm" | "lg"
  className?: string
}

/**
 * Shop-Kartenpreis: Sale zuerst, dann Kundenkategorie on top.
 * Beispiel: UVP 20 → Sale 10% = 18 → Kategorie −50% = **9.00** ~~20.00~~
 */
export function ProductShopPrice({
  product,
  size = "sm",
  className,
}: ProductShopPriceProps) {
  const { discountPercent, category, loaded } = useCustomerCategory()
  const priced = calculateProductPrice({
    price: Number.isFinite(product.price) ? product.price : 0,
    originalPrice: product.originalPrice,
    sale: product.sale,
    categoryDiscountPercent: loaded ? discountPercent : 0,
  })

  const showCategoryBadge =
    loaded && priced.categoryDiscountPercent > 0 && priced.unitPrice > 0

  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span
        className={cn(
          "font-bold tabular-nums",
          size === "lg" ? "text-2xl sm:text-3xl" : "text-lg",
          (priced.onSale || showCategoryBadge) && "text-red-400"
        )}
      >
        CHF {priced.unitPrice.toFixed(2)}
      </span>
      {priced.strikePrice != null &&
        priced.strikePrice > priced.unitPrice + 0.001 && (
          <span
            className={cn(
              "text-muted-foreground line-through tabular-nums",
              size === "lg" ? "text-lg" : "text-sm"
            )}
          >
            CHF {priced.strikePrice.toFixed(2)}
          </span>
        )}
      {showCategoryBadge && (
        <span
          className={cn(
            "rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300",
            size === "lg" ? "text-xs" : "text-[10px]"
          )}
          title={category?.name ? `Kundenrabatt: ${category.name}` : undefined}
        >
          −{priced.categoryDiscountPercent}%
        </span>
      )}
    </div>
  )
}
