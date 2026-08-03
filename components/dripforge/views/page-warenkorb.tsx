"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import {
  Home,
  Printer,
  Zap,
  ShoppingBag,
  MessageSquare,
  Menu,
  X,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  Leaf,
  Scissors,
  Stamp,
  CheckCircle2,
  Circle,
  Sparkles,
  Package,
  Timer,
  Gem,
  Layers,
  ArrowRight,
  MessageCircle,
  User,
  Bot,
  Upload,
  Box,
  RotateCcw,
  ZoomIn,
  Minus,
  Plus,
  ShoppingCart,
  Image as ImageIcon,
  Tag,
  Search,
  Moon,
  Sun,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { FilamentColorPicker } from "@/components/dripforge/shared/filament-color-picker"
import { ProcessStepItem } from "@/components/dripforge/shared/process-step-item"
import { LaserProcessStep } from "@/components/dripforge/shared/laser-process-step"
import { IndividualProcessBar } from "@/components/dripforge/shared/individual-process-bar"
import { materials3D, laserMaterials, processSteps, products } from "@/lib/dripforge/data"
import { LASER_FONT_OPTIONS } from "@/lib/dripforge/laser-design"
import type { CartItem } from "@/lib/dripforge/types"
import {
  calculateCheckoutTotals,
  DEFAULT_CHECKOUT_RUNTIME_CONFIG,
  getShippingCost,
  type CheckoutRuntimeConfig,
} from "@/lib/dripforge/checkout-config"
import { useCustomerCategory } from "@/components/dripforge/customer-category-provider"

export function PageWarenkorb({ 
  setCurrentView, 
  cart, 
  setCart 
}: { 
  setCurrentView: (view: string) => void
  cart: CartItem[]
  setCart: (cart: CartItem[]) => void
}) {
  const { applyDiscount: applyCategoryDiscount, discountPercent: categoryDiscountPercent } =
    useCustomerCategory()

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id)
    } else {
      setCart(cart.map(item => 
        item.id === id ? { ...item, quantity } : item
      ))
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
              {cart.map((item) => (
                <Card key={item.id} className="border-border/50 bg-card/50">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4 md:flex-row">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          {item.type === "3d" ? (
                            <>
                              <Printer className="h-4 w-4 text-primary" />
                              <span className="text-xs text-primary">3D-Druck</span>
                            </>
                          ) : (
                            <>
                              <Zap className="h-4 w-4 text-cyan-400" />
                              <span className="text-xs text-cyan-400">Laser</span>
                            </>
                          )}
                        </div>
                        <h3 className="mb-2 font-bold text-foreground">{item.name}</h3>
                        {item.leitbild && (
                          <div className="mb-3 max-w-xs overflow-hidden rounded-lg border border-border/50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.leitbild}
                              alt="Leitbild der Live-Vorschau"
                              className="aspect-video w-full object-contain bg-muted/30"
                            />
                          </div>
                        )}
                        {item.customDetails && (
                          <div className="text-sm text-muted-foreground space-y-1">
                            {item.customDetails.filament && (
                              <p>Filament: {item.customDetails.filament}</p>
                            )}
                            {item.customDetails.color && (
                              <p>Farbe: {item.customDetails.color}</p>
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
                      </div>
                      <div className="text-right">
                        {categoryDiscountPercent > 0 ? (
                          <p className="mb-4 text-lg font-bold">
                            CHF {applyCategoryDiscount(item.price).toFixed(2)}
                            <span className="ml-2 text-sm font-normal text-muted-foreground line-through">
                              CHF {item.price.toFixed(2)}
                            </span>
                          </p>
                        ) : (
                          <p className="mb-4 text-lg font-bold">CHF {item.price.toFixed(2)}</p>
                        )}
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
              ))}
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
