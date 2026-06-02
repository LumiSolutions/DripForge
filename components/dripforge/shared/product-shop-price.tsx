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
  const onSale = product.sale && product.originalPrice != null

  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span
        className={cn(
          "font-bold tabular-nums",
          size === "lg" ? "text-2xl sm:text-3xl" : "text-lg",
          onSale && "text-red-400"
        )}
      >
        CHF {product.price.toFixed(2)}
      </span>
      {onSale && (
        <span
          className={cn(
            "text-muted-foreground line-through tabular-nums",
            size === "lg" ? "text-lg" : "text-sm"
          )}
        >
          CHF {product.originalPrice!.toFixed(2)}
        </span>
      )}
    </div>
  )
}
