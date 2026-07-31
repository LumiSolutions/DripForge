"use client"

import { ArrowRight, Printer, Zap } from "lucide-react"
import { Card } from "@/components/ui/card"
import { SafeProductImage } from "@/components/dripforge/shared/safe-product-image"
import { ProductShopPrice } from "@/components/dripforge/shared/product-shop-price"
import { getSaleBadgePercent } from "@/lib/dripforge/product-sale"
import type { Product } from "@/lib/dripforge/types"
import { cn } from "@/lib/utils"

export type ShopCardSurface = "brand" | "neutral"

type ShopProductCardProps = {
  product: Product
  coverSrc: string
  viewMode: "grid3" | "grid5" | "list"
  surface?: ShopCardSurface
  onOpen: () => void
}

export function ShopProductCard({
  product,
  coverSrc,
  viewMode,
  surface = "brand",
  onOpen,
}: ShopProductCardProps) {
  const salePercent = getSaleBadgePercent(product)
  const isList = viewMode === "list"

  if (isList) {
    return (
      <Card
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onOpen()
          }
        }}
        className={cn(
          "cursor-pointer overflow-hidden border-border/50 transition-colors hover:border-primary/50 hover:shadow-md",
          surface === "brand"
            ? "bg-gradient-to-br from-orange-500/20 via-card to-cyan-500/20"
            : "bg-card/50",
          product.sale && "border-red-500/30 hover:border-red-500/60"
        )}
      >
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-lg bg-secondary/40 sm:h-28 sm:w-36">
            {product.sale && salePercent != null && (
              <span className="absolute left-2 top-2 z-10 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                -{salePercent}%
              </span>
            )}
            <SafeProductImage
              src={coverSrc}
              alt={product.name}
              fill
              sizes="160px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              {product.type === "3d" ? (
                <>
                  <Printer className="h-3 w-3" />
                  3D-Druck
                </>
              ) : (
                <>
                  <Zap className="h-3 w-3" />
                  Laser
                </>
              )}
            </div>
            <h3 className="font-bold">{product.name}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {product.description}
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end">
            <ProductShopPrice product={product} />
            <span className="inline-flex items-center text-sm font-medium text-primary">
              Ansehen
              <ArrowRight className="ml-1 h-4 w-4" />
            </span>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        "group cursor-pointer overflow-hidden border-border/50 p-0 transition-colors hover:border-primary/50 hover:shadow-md",
        product.sale && "border-red-500/30 hover:border-red-500/60"
      )}
    >
      <div
        className={cn(
          "relative aspect-[4/5] w-full overflow-hidden",
          viewMode === "grid5" ? "min-h-[11rem]" : "min-h-[14rem]",
          surface === "brand"
            ? "bg-gradient-to-br from-orange-500 via-amber-600 to-cyan-600"
            : "bg-secondary/60"
        )}
      >
        <SafeProductImage
          src={coverSrc}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {product.sale && salePercent != null && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white shadow">
            -{salePercent}%
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-black/60 p-3 text-white backdrop-blur-md sm:p-4">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-white/80">
            {product.type === "3d" ? (
              <>
                <Printer className="h-3 w-3" />
                3D-Druck
              </>
            ) : (
              <>
                <Zap className="h-3 w-3" />
                Laser
              </>
            )}
          </div>
          <h3 className="mb-1 line-clamp-2 text-sm font-bold leading-snug sm:text-base">
            {product.name}
          </h3>
          <p className="mb-3 line-clamp-2 text-xs text-white/75">
            {product.description}
          </p>
          <div className="flex items-center justify-between gap-2">
            <ProductShopPrice
              product={product}
              className="[&_span]:text-white [&_span.line-through]:text-white/50"
            />
            <span className="inline-flex shrink-0 items-center text-xs font-medium text-white/90 sm:text-sm">
              Ansehen
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
