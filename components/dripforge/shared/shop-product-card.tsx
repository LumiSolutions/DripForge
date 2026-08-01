"use client"

import { ArrowRight, Printer, Zap } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { SafeProductImage } from "@/components/dripforge/shared/safe-product-image"
import { ProductShopPrice } from "@/components/dripforge/shared/product-shop-price"
import { WishlistButton } from "@/components/konto/wishlist-button"
import { getSaleBadgePercent } from "@/lib/dripforge/product-sale"
import {
  productImageBayClass,
  productImageShapeClass,
  type Product,
} from "@/lib/dripforge/types"
import { cn } from "@/lib/utils"

export type ShopCardSurface = "brand" | "neutral"

type ShopProductCardProps = {
  product: Product
  coverSrc: string
  viewMode: "grid3" | "grid5" | "list"
  surface?: ShopCardSurface
  onOpen: () => void
  canInlineEdit?: boolean
}

function normalizeShapeAspect(
  shape: Product["imageShape"],
  viewMode: ShopProductCardProps["viewMode"]
): string {
  if (shape === "circle") return "aspect-square min-h-[12rem]"
  if (shape === "square") {
    return viewMode === "grid5"
      ? "aspect-square min-h-[10rem]"
      : "aspect-square min-h-[12rem]"
  }
  return viewMode === "grid5"
    ? "aspect-[5/4] min-h-[10rem]"
    : "aspect-[4/3] min-h-[12rem]"
}

export function ShopProductCard({
  product,
  coverSrc,
  viewMode,
  surface = "brand",
  onOpen,
  canInlineEdit = false,
}: ShopProductCardProps) {
  const salePercent = getSaleBadgePercent(product)
  const isList = viewMode === "list"

  const typeBadge = (
    <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
      {product.type === "3d" ? (
        <>
          <Printer className="h-3.5 w-3.5" />
          3D-Druck
        </>
      ) : (
        <>
          <Zap className="h-3.5 w-3.5" />
          Laser
        </>
      )}
    </div>
  )

  if (isList) {
    return (
      <Card
        role={canInlineEdit ? undefined : "button"}
        tabIndex={canInlineEdit ? undefined : 0}
        onClick={() => {
          if (!canInlineEdit) onOpen()
        }}
        onKeyDown={(e) => {
          if (canInlineEdit) return
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onOpen()
          }
        }}
        className={cn(
          "relative overflow-hidden border-border/50 transition-colors",
          canInlineEdit
            ? "cursor-default"
            : "cursor-pointer hover:border-primary/50 hover:shadow-md",
          surface === "brand"
            ? "bg-gradient-to-br from-orange-500/10 via-card to-cyan-500/10"
            : "bg-card",
          product.sale && "border-red-500/30 hover:border-red-500/60"
        )}
      >
        {canInlineEdit && (
          <span className="absolute right-2 top-2 z-20 rounded-md border border-amber-500/40 bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
            Dynamisch aus Shop
          </span>
        )}
        {!canInlineEdit && (
          <WishlistButton
            productId={product.id}
            size="sm"
            className="absolute right-2 top-2 z-20"
          />
        )}
        <div
          className={cn(
            "flex flex-col gap-4 p-4 sm:flex-row sm:items-center",
            canInlineEdit && "pointer-events-none select-none"
          )}
        >
          <div
            className={cn(
              "relative h-40 w-full shrink-0 overflow-hidden p-2.5 sm:h-32 sm:w-40",
              productImageBayClass(product.imageShape),
              surface === "brand"
                ? "bg-gradient-to-br from-orange-500/15 to-cyan-500/15"
                : "bg-secondary/50"
            )}
          >
            {product.sale && salePercent != null && (
              <span className="absolute left-2 top-2 z-10 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                -{salePercent}%
              </span>
            )}
            <div
              className={cn(
                "relative h-full w-full overflow-hidden",
                productImageShapeClass(product.imageShape)
              )}
            >
              <SafeProductImage
                src={coverSrc}
                alt={product.name}
                fill
                sizes="200px"
                className="object-contain p-1.5"
              />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            {typeBadge}
            <h3 className="text-base font-bold leading-snug text-foreground">
              {product.name}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
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
      role={canInlineEdit ? undefined : "button"}
      tabIndex={canInlineEdit ? undefined : 0}
      onClick={() => {
        if (!canInlineEdit) onOpen()
      }}
      onKeyDown={(e) => {
        if (canInlineEdit) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        "group relative flex flex-col overflow-hidden border-border/50 p-0 transition-colors",
        canInlineEdit
          ? "cursor-default"
          : "cursor-pointer hover:border-primary/50 hover:shadow-md",
        surface === "brand" ? "bg-card" : "bg-card",
        product.sale && "border-red-500/30 hover:border-red-500/60"
      )}
    >
      {canInlineEdit && (
        <span className="absolute right-2 top-2 z-20 rounded-md border border-amber-500/40 bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
          Dynamisch aus Shop
        </span>
      )}
      {!canInlineEdit && (
        <WishlistButton
          productId={product.id}
          size="sm"
          className="absolute right-2 top-2 z-20"
        />
      )}
      <div
        className={cn(
          "relative w-full overflow-hidden p-3",
          normalizeShapeAspect(product.imageShape, viewMode),
          productImageBayClass(product.imageShape),
          surface === "brand"
            ? "bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-cyan-500/20"
            : "bg-secondary/40",
          canInlineEdit && "pointer-events-none select-none"
        )}
      >
        <div
          className={cn(
            "relative h-full w-full overflow-hidden bg-background/40",
            productImageShapeClass(product.imageShape)
          )}
        >
          <SafeProductImage
            src={coverSrc}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain p-2 transition-transform duration-300 group-hover:scale-[1.02] sm:p-3"
          />
        </div>
        {product.sale && salePercent != null && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white shadow">
            -{salePercent}%
          </span>
        )}
      </div>
      <CardContent
        className={cn(
          "flex flex-1 flex-col gap-2 border-t border-border/40 bg-card p-3 sm:p-4",
          canInlineEdit && "pointer-events-none select-none"
        )}
      >
        {typeBadge}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground sm:text-base">
          {product.name}
        </h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {product.description}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <ProductShopPrice product={product} />
          <span className="inline-flex shrink-0 items-center text-xs font-medium text-primary sm:text-sm">
            Ansehen
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
