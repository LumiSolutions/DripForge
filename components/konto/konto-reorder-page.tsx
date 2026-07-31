"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCw, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { KontoShell } from "@/components/konto/konto-shell"
import { SafeProductImage } from "@/components/dripforge/shared/safe-product-image"
import { useCart } from "@/components/dripforge/cart-provider"
import { productHref } from "@/lib/dripforge/product-slug"

type Suggestion = {
  productId: string
  name: string
  type: "3d" | "laser"
  price: number
  imageUrl: string | null
  lastOrderedAt: string
  orderCount: number
}

export function KontoReorderPage() {
  const { addToCart } = useCart()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)

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
                item.imageUrl?.trim() || "/filaments/printed-pla-schwarz.png"
              return (
                <Card key={`${item.productId}-${item.name}`} className="rounded-2xl border-border/50">
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
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.orderCount}× bestellt · zuletzt{" "}
                        {new Intl.DateTimeFormat("de-CH", {
                          dateStyle: "medium",
                        }).format(new Date(item.lastOrderedAt))}
                      </p>
                      <p className="text-sm tabular-nums">
                        CHF {Number(item.price).toFixed(2)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            addToCart({
                              id: `${item.productId}-${Date.now()}`,
                              name: item.name,
                              price: Number(item.price) || 0,
                              quantity: 1,
                              type: item.type,
                            })
                          }
                        >
                          <ShoppingBag className="mr-1 h-3.5 w-3.5" />
                          Nachbestellen
                        </Button>
                        <Button type="button" size="sm" variant="outline" asChild>
                          <Link href={productHref({ id: item.productId, name: item.name })}>
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
