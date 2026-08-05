"use client"

import { useState, useEffect, type Dispatch, type SetStateAction } from "react"
import Link from "next/link"
import {
  ShoppingBag,
  ShoppingCart,
  X,
  Layers,
  ArrowRight,
  Minus,
  Plus,
  Printer,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { LASER_FONT_OPTIONS } from "@/lib/dripforge/laser-design"
import type { CartItem } from "@/lib/dripforge/types"
import {
  calculateCheckoutTotals,
  DEFAULT_CHECKOUT_RUNTIME_CONFIG,
  getShippingCost,
  type CheckoutRuntimeConfig,
} from "@/lib/dripforge/checkout-config"
import { useCustomerCategory } from "@/components/dripforge/customer-category-provider"
import { SafeProductImage } from "@/components/dripforge/shared/safe-product-image"
import { productHref } from "@/lib/dripforge/product-slug"
import { resolveCartPreviewSrc } from "@/lib/dripforge/cart-preview-persist"

function formatPartColorsLabel(
  partColors: NonNullable<NonNullable<CartItem["customDetails"]>["partColors"]>
): string {
  return partColors
    .map((p) => {
      const filament = p.filament?.trim()
      return `${p.partName}: ${p.colorName}${filament ? ` (${filament})` : ""}`
    })
    .join(" | ")
}

function variantLabel(item: CartItem): string {
  const d = item.customDetails
  if (!d) return "Konfiguration"

  if (Array.isArray(d.partColors) && d.partColors.length > 0) {
    return formatPartColorsLabel(d.partColors)
  }

  const parts: string[] = []
  if (d.color) parts.push(d.color)
  if (d.filament) parts.push(d.filament)
  const variant = d.variant ?? d.materialVariant
  if (variant) parts.push(variant)
  const gravur = d.userText ?? d.engravingText
  if (gravur) parts.push(`Gravur: ${gravur}`)
  return parts.length > 0 ? parts.join(" · ") : "Konfiguration"
}

function groupCartByProduct(cart: CartItem[]): { key: string; items: CartItem[] }[] {
  const groups = new Map<string, CartItem[]>()
  for (const item of cart) {
    const key = item.productId?.trim() || item.id
    const existing = groups.get(key)
    if (existing) existing.push(item)
    else groups.set(key, [item])
  }
  return Array.from(groups.entries()).map(([key, items]) => ({ key, items }))
}

function CartProductTitle({ item }: { item: CartItem }) {
  const href =
    item.productId?.trim()
      ? productHref({ id: item.productId, name: item.name })
      : null
  if (!href) {
    return <h3 className="font-bold text-foreground">{item.name}</h3>
  }
  return (
    <h3 className="font-bold text-foreground">
      <Link
        href={href}
        className="underline-offset-4 hover:text-primary hover:underline"
      >
        {item.name}
      </Link>
    </h3>
  )
}

function TypeBadge({ type }: { type: "3d" | "laser" }) {
  if (type === "3d") {
    return (
      <Badge variant="outline" className="border-primary/30 text-primary">
        <Printer className="mr-1 h-3 w-3" />
        3D-Druck
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
      <Zap className="mr-1 h-3 w-3" />
      Laser
    </Badge>
  )
}

function CartUnitPrice({
  item,
  categoryDiscountPercent,
  applyCategoryDiscount,
  className,
}: {
  item: CartItem
  categoryDiscountPercent: number
  applyCategoryDiscount: (price: number) => number
  className?: string
}) {
  const hasTierDiscount =
    item.baseUnitPrice != null && item.baseUnitPrice > item.price
  const hasCategoryDiscount = categoryDiscountPercent > 0
  const displayPrice = hasCategoryDiscount
    ? applyCategoryDiscount(item.price)
    : item.price

  return (
    <p className={cn("font-bold", className ?? "text-lg")}>
      CHF {displayPrice.toFixed(2)}
      {hasCategoryDiscount && (
        <span className="ml-2 text-sm font-normal text-muted-foreground line-through">
          CHF {item.price.toFixed(2)}
        </span>
      )}
      {hasTierDiscount && (
        <span className="ml-2 text-sm font-normal text-muted-foreground line-through">
          CHF {item.baseUnitPrice!.toFixed(2)}
        </span>
      )}
    </p>
  )
}

function SingleCartItemDetails({ item }: { item: CartItem }) {
  const partColors = item.customDetails?.partColors
  const previewSrc = resolveCartPreviewSrc(item)
  return (
    <>
      {previewSrc ? (
        <div className="relative mb-3 aspect-video max-w-xs overflow-hidden rounded-lg border border-border/50">
          <SafeProductImage
            src={previewSrc}
            alt="Leitbild der Live-Vorschau"
            fill
            sizes="320px"
            className="object-contain bg-muted/30"
          />
        </div>
      ) : null}
      {item.customDetails && (
        <div className="text-sm text-muted-foreground space-y-1">
          {Array.isArray(partColors) && partColors.length > 0 ? (
            <p>{formatPartColorsLabel(partColors)}</p>
          ) : (
            <>
              {item.customDetails.filament && (
                <p>Filament: {item.customDetails.filament}</p>
              )}
              {item.customDetails.color && (
                <p>Farbe: {item.customDetails.color}</p>
              )}
            </>
          )}
          {item.customDetails.dimensions && (
            <p>Abmessungen: {item.customDetails.dimensions}</p>
          )}
          {item.customDetails.material && (
            <p>Material: {item.customDetails.material}</p>
          )}
          {(item.customDetails.variant ||
            item.customDetails.materialVariant) && (
            <p>
              Variante:{" "}
              {item.customDetails.variant ??
                item.customDetails.materialVariant}
            </p>
          )}
          {item.customDetails.userFont && (
            <p>
              Schrift:{" "}
              {LASER_FONT_OPTIONS.find(
                (f) => f.id === item.customDetails?.userFont
              )?.label ?? item.customDetails.userFont}
            </p>
          )}
          {item.customDetails.size && (
            <p>Grösse: {item.customDetails.size}</p>
          )}
          {(item.customDetails.userText ||
            item.customDetails.engravingText) && (
            <p>
              Gravur:{" "}
              {item.customDetails.userText ??
                item.customDetails.engravingText}
            </p>
          )}
          {item.customDetails.uploadedImage && (
            <p>Logo: hochgeladen</p>
          )}
          {item.customDetails.layoutCoordinates?.textPosition && (
            <p className="text-xs opacity-80">
              Text: {Math.round(item.customDetails.layoutCoordinates.textPosition.x)}% /{" "}
              {Math.round(item.customDetails.layoutCoordinates.textPosition.y)}%
              {item.customDetails.layoutCoordinates.textPosition.scale != null &&
                ` · ${item.customDetails.layoutCoordinates.textPosition.scale.toFixed(1)}x`}
              {item.customDetails.layoutCoordinates.textPosition.rotation != null &&
                ` · ${Math.round(item.customDetails.layoutCoordinates.textPosition.rotation)}°`}
            </p>
          )}
          {item.customDetails.layoutCoordinates?.imagePosition &&
            item.customDetails.uploadedImage && (
            <p className="text-xs opacity-80">
              Bild: {Math.round(item.customDetails.layoutCoordinates.imagePosition.x)}% /{" "}
              {Math.round(item.customDetails.layoutCoordinates.imagePosition.y)}%
              {item.customDetails.layoutCoordinates.imagePosition.scale != null &&
                ` · ${item.customDetails.layoutCoordinates.imagePosition.scale.toFixed(1)}x`}
              {item.customDetails.layoutCoordinates.imagePosition.rotation != null &&
                ` · ${Math.round(item.customDetails.layoutCoordinates.imagePosition.rotation)}°`}
            </p>
          )}
        </div>
      )}
    </>
  )
}

export function PageWarenkorb({ 
  setCurrentView, 
  cart, 
  setCart 
}: { 
  setCurrentView: (view: string) => void
  cart: CartItem[]
  setCart: Dispatch<SetStateAction<CartItem[]>>
}) {
  const { applyDiscount: applyCategoryDiscount, discountPercent: categoryDiscountPercent } =
    useCustomerCategory()

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id))
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id)
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, quantity } : item
        )
      )
    }
  }

  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutRuntimeConfig>(
    DEFAULT_CHECKOUT_RUNTIME_CONFIG
  )

  useEffect(() => {
    void fetch("/api/settings/checkout")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.mwstAktiv !== undefined) {
          setCheckoutConfig(data as CheckoutRuntimeConfig)
        }
      })
      .catch(() => {
        console.warn("Warenkorb: Admin-Einstellungen konnten nicht geladen werden.")
      })
  }, [])

  const baseSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const categoryDiscountChf =
    categoryDiscountPercent > 0
      ? Math.round(baseSubtotal * (categoryDiscountPercent / 100) * 100) / 100
      : 0
  const subtotal = Math.max(0, baseSubtotal - categoryDiscountChf)
  const shipping = subtotal > 0 ? getShippingCost("bpost") : 0
  const totals = calculateCheckoutTotals(subtotal, shipping, checkoutConfig)

  return (
    <div className="space-y-8 py-8">
      {/* Header */}
      <div className="mx-auto max-w-6xl px-4 text-center">
        <Badge variant="secondary" className="mb-4">Shopping Cart</Badge>
        <h1 className="text-4xl font-bold">
          <span className="text-foreground">Mein </span>
          <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Warenkorb</span>
        </h1>
      </div>

      <div className="mx-auto max-w-6xl px-4">
        {cart.length === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="py-16 text-center">
              <ShoppingBag className="mx-auto mb-4 h-16 w-16 opacity-30" />
              <h2 className="mb-2 text-xl font-bold">Warenkorb ist leer</h2>
              <p className="mb-6 text-muted-foreground">
                Fügen Sie Produkte hinzu, um Ihre Bestellung zu starten
              </p>
              <Button 
                onClick={() => setCurrentView("shop")}
                className="bg-primary hover:bg-primary/90"
              >
                Zum Shop
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {groupCartByProduct(cart).map((group) => {
                const isMultiVariant = group.items.length >= 2

                if (isMultiVariant) {
                  const first = group.items[0]
                  const groupFallbackPreview = resolveCartPreviewSrc(first)
                  return (
                    <Card key={group.key} className="border-border/50 bg-card/50">
                      <CardContent className="p-6">
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                          <TypeBadge type={first.type} />
                          <Badge variant="secondary" className="gap-1">
                            <Layers className="h-3 w-3" />
                            Mehrere Variationen
                          </Badge>
                        </div>
                        <div className="mb-4">
                          <CartProductTitle item={first} />
                        </div>
                        <div className="space-y-3">
                          {group.items.map((item) => {
                            const previewSrc =
                              resolveCartPreviewSrc(item) || groupFallbackPreview
                            return (
                            <div
                              key={item.id}
                              className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                <div className="w-24 shrink-0 space-y-1">
                                  <div className="relative h-16 w-24 overflow-hidden rounded-md border border-border/50 bg-muted/30">
                                    {previewSrc ? (
                                      <SafeProductImage
                                        src={previewSrc}
                                        alt="Leitbild der Variante"
                                        fill
                                        sizes="96px"
                                        className="object-contain"
                                      />
                                    ) : (
                                      <div className="absolute inset-0 bg-muted/40" />
                                    )}
                                  </div>
                                  {first.type === "3d" ? (
                                    <p className="text-[10px] leading-snug text-muted-foreground">
                                      Abbildung dient als Ausführungsvorschau –
                                      gewählte Farben siehe Spezifikation
                                    </p>
                                  ) : null}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {variantLabel(item)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-4 sm:gap-6">
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                    aria-label="Menge verringern"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="w-8 text-center font-bold">{item.quantity}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    aria-label="Menge erhöhen"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                                <CartUnitPrice
                                  item={item}
                                  categoryDiscountPercent={categoryDiscountPercent}
                                  applyCategoryDiscount={applyCategoryDiscount}
                                  className="min-w-[7rem] text-right text-base"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeFromCart(item.id)}
                                  className="h-8 w-8 shrink-0 p-0 text-destructive hover:text-destructive/80"
                                  aria-label="Variante entfernen"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )
                }

                const item = group.items[0]
                return (
                  <Card key={item.id} className="border-border/50 bg-card/50">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4 md:flex-row">
                        <div className="flex-1">
                          <div className="mb-2">
                            <TypeBadge type={item.type} />
                          </div>
                          <div className="mb-2">
                            <CartProductTitle item={item} />
                          </div>
                          <SingleCartItemDetails item={item} />
                        </div>
                        <div className="text-right">
                          <CartUnitPrice
                            item={item}
                            categoryDiscountPercent={categoryDiscountPercent}
                            applyCategoryDiscount={applyCategoryDiscount}
                            className="mb-4 text-lg"
                          />
                          <div className="flex items-center gap-3 justify-end mb-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-bold">{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeFromCart(item.id)}
                            className="text-destructive hover:text-destructive/80 w-full"
                          >
                            Entfernen
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Order Summary */}
            <div>
              <Card className="border-primary/30 bg-gradient-to-b from-primary/10 to-transparent sticky top-20">
                <CardContent className="p-6">
                  <h2 className="mb-4 text-xl font-bold">Bestellzusammenfassung</h2>
                  <div className="space-y-3 border-b border-border pb-4 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Zwischensumme</span>
                      <span>CHF {baseSubtotal.toFixed(2)}</span>
                    </div>
                    {categoryDiscountChf > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Kundenrabatt ({categoryDiscountPercent}%)
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          − CHF {categoryDiscountChf.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Versand</span>
                      <span>CHF {totals.shippingCost.toFixed(2)}</span>
                    </div>
                    {checkoutConfig.mwstAktiv ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          MwSt. ({checkoutConfig.mwstSatz.toFixed(1)}%)
                        </span>
                        <span>CHF {totals.vat.toFixed(2)}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Preise ohne MwSt. (Kleinunternehmer)
                      </p>
                    )}
                  </div>
                  <div className="mb-6 flex justify-between text-lg font-bold">
                    <span>Gesamtbetrag</span>
                    <span className="text-primary">CHF {totals.total.toFixed(2)}</span>
                  </div>
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 mb-3"
                    size="lg"
                    onClick={() => setCurrentView("checkout")}
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Zur Kasse
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => setCurrentView("shop")}
                  >
                    Weiteres Einkaufen
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
