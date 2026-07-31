"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw, ShoppingBag, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { KontoShell } from "@/components/konto/konto-shell"
import { SafeProductImage } from "@/components/dripforge/shared/safe-product-image"
import { useCart } from "@/components/dripforge/cart-provider"
import { productHref } from "@/lib/dripforge/product-slug"
import type { CartItem } from "@/lib/dripforge/types"

type Suggestion = {
  productId: string
  name: string
  type: "3d" | "laser"
  price: number
  imageUrl: string | null
  lastOrderedAt: string
  orderCount: number
  hasDesign: boolean
  engravingText: string | null
  designPreviewUrl: string | null
  designConfig: Record<string, unknown> | null
  savedDesignId: string | null
  savedDesignLabel: string | null
}

function buildCartItem(
  item: Suggestion,
  withDesign: boolean
): CartItem {
  const base: CartItem = {
    id: `${item.productId}-${Date.now()}`,
    name: item.name,
    price: Number(item.price) || 0,
    quantity: 1,
    type: item.type,
  }

  if (!withDesign || !item.designConfig) {
    return base
  }

  const config = item.designConfig
  const preview =
    item.designPreviewUrl?.trim() ||
    (typeof config.previewMockupUrl === "string"
      ? config.previewMockupUrl
      : null)

  const layoutCoordinates =
    config.layoutCoordinates && typeof config.layoutCoordinates === "object"
      ? (config.layoutCoordinates as NonNullable<
          CartItem["customDetails"]
        >["layoutCoordinates"])
      : undefined

  return {
    ...base,
    previewMockup: preview?.startsWith("data:") ? preview : undefined,
    leitbild: preview?.startsWith("data:") ? preview : undefined,
    customDetails: {
      material:
        typeof config.material === "string" ? config.material : undefined,
      materialVariant:
        typeof config.materialVariant === "string"
          ? config.materialVariant
          : undefined,
      variant: typeof config.variant === "string" ? config.variant : undefined,
      size: typeof config.size === "string" ? config.size : undefined,
      filament:
        typeof config.filament === "string" ? config.filament : undefined,
      color: typeof config.color === "string" ? config.color : undefined,
      dimensions:
        typeof config.dimensions === "string" ? config.dimensions : undefined,
      scale: typeof config.scale === "string" ? config.scale : undefined,
      engravingText:
        typeof config.engravingText === "string"
          ? config.engravingText
          : item.engravingText ?? undefined,
      userText:
        typeof config.userText === "string"
          ? config.userText
          : item.engravingText ?? undefined,
      userFont:
        typeof config.userFont === "string"
          ? config.userFont
          : typeof config.selectedFont === "string"
            ? config.selectedFont
            : undefined,
      uploadedImage:
        typeof config.uploadedImage === "string" ? config.uploadedImage : null,
      uploadedImages: Array.isArray(config.uploadedImages)
        ? (config.uploadedImages as string[])
        : undefined,
      hasImage: Boolean(config.hasImage || config.uploadedImage),
      hasText: Boolean(
        config.hasText ||
          config.engravingText ||
          config.userText ||
          item.engravingText
      ),
      layoutCoordinates,
      productBackgroundUrl:
        typeof config.productBackgroundUrl === "string"
          ? config.productBackgroundUrl
          : null,
      fileName: typeof config.fileName === "string" ? config.fileName : undefined,
      fileUrl: typeof config.fileUrl === "string" ? config.fileUrl : null,
      modelUrl: typeof config.modelUrl === "string" ? config.modelUrl : null,
      isCustomerInbound: Boolean(config.isCustomerInbound),
    },
  }
}

export function KontoReorderPage() {
  const { addToCart } = useCart()
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    void fetch("/api/konto/reorder-suggestions", {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/konto/login?next=/konto/bestellvorschlag"
          return
        }
        const data = (await res.json()) as { suggestions?: Suggestion[] }
        setSuggestions(data.suggestions ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  const reorder = (item: Suggestion, withDesign: boolean) => {
    addToCart(buildCartItem(item, withDesign))
    setFeedback(
      withDesign
        ? `«${item.name}» mit gespeichertem Design im Warenkorb.`
        : `«${item.name}» im Warenkorb.`
    )
    window.setTimeout(() => {
      router.push("/warenkorb")
    }, 400)
  }

  return (
    <KontoShell>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <RefreshCw className="h-6 w-6 text-primary" />
            Bestellvorschlag
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Produkte aus früheren Bestellungen — mit einem Klick nachbestellen.
          </p>
        </div>

        {feedback ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {feedback}
          </p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="text-sm font-medium">Noch keine Vorschläge</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sobald du bestellt hast, erscheinen hier deine häufigen Produkte.
            </p>
            <Button asChild className="mt-4">
              <Link href="/shop">Zum Shop</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {suggestions.map((item) => {
              const cover =
                item.designPreviewUrl?.trim() ||
                item.imageUrl?.trim() ||
                "/filaments/printed-pla-schwarz.png"
              return (
                <Card
                  key={`${item.productId}-${item.name}`}
                  className="rounded-2xl border-border/50"
                >
                  <CardContent className="flex gap-4 p-4">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary/50">
                      <SafeProductImage
                        src={cover}
                        alt={item.name}
                        fill
                        sizes="96px"
                        className="object-contain p-2"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{item.name}</p>
                        {item.hasDesign ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-primary/40 text-[10px] text-primary"
                          >
                            <Palette className="h-3 w-3" />
                            Design
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.orderCount}× bestellt · zuletzt{" "}
                        {new Intl.DateTimeFormat("de-CH", {
                          dateStyle: "medium",
                        }).format(new Date(item.lastOrderedAt))}
                      </p>
                      {item.engravingText ? (
                        <p className="text-xs text-muted-foreground">
                          Gravur: {item.engravingText}
                        </p>
                      ) : null}
                      {item.savedDesignLabel ? (
                        <p className="text-xs text-muted-foreground">
                          Verknüpft: {item.savedDesignLabel}
                        </p>
                      ) : null}
                      <p className="text-sm tabular-nums">
                        CHF {Number(item.price).toFixed(2)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {item.hasDesign && item.designConfig ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => reorder(item, true)}
                            >
                              <ShoppingBag className="mr-1 h-3.5 w-3.5" />
                              Mit Design
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => reorder(item, false)}
                            >
                              Ohne Design
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => reorder(item, false)}
                          >
                            <ShoppingBag className="mr-1 h-3.5 w-3.5" />
                            Nachbestellen
                          </Button>
                        )}
                        <Button type="button" size="sm" variant="outline" asChild>
                          <Link
                            href={productHref({
                              id: item.productId,
                              name: item.name,
                            })}
                          >
                            Ansehen
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </KontoShell>
  )
}
