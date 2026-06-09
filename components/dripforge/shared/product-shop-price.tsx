import { cn } from "@/lib/utils"
import type { Product } from "@/lib/dripforge/types"

type ProductShopPriceProps = {
  product: Product
  size?: "sm" | "lg"
  className?: string
}

export function ProductShopPrice({
  product,
  size = "sm",
  className,
}: ProductShopPriceProps) {
  const price = Number.isFinite(product.price) ? product.price : 0
  const original =
    product.originalPrice != null && Number.isFinite(product.originalPrice)
      ? product.originalPrice
      : null
  const onSale = product.sale && original != null

  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span
        className={cn(
          "font-bold tabular-nums",
          size === "lg" ? "text-2xl sm:text-3xl" : "text-lg",
          onSale && "text-red-400"
        )}
      >
        CHF {price.toFixed(2)}
      </span>
      {onSale && original != null && (
        <span
          className={cn(
            "text-muted-foreground line-through tabular-nums",
            size === "lg" ? "text-lg" : "text-sm"
          )}
        >
          CHF {original.toFixed(2)}
        </span>
      )}
    </div>
  )
}
