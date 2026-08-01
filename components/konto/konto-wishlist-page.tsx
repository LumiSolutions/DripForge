"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Heart, Loader2, ShoppingBag, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { KontoShell } from "@/components/konto/konto-shell"
import { SafeProductImage } from "@/components/dripforge/shared/safe-product-image"
import { useCart } from "@/components/dripforge/cart-provider"
import { productHref } from "@/lib/dripforge/product-slug"

type WishlistRow = {
  productId: string
  addedAt: string
  product: {
    id: string
    name: string
    type: "3d" | "laser"
    price: number
    images?: string[]
  }
}

export function KontoWishlistPage() {
  const { addToCart } = useCart()
  const [items, setItems] = useState<WishlistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/konto/wishlist", {
        cache: "no-store",
        credentials: "include",
      })
      if (res.status === 401) {
        window.location.href = "/konto/login?next=/konto/merkliste"
        return
      }
      const data = (await res.json()) as { items?: WishlistRow[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setItems(data.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const remove = async (productId: string) => {
    await fetch("/api/konto/wishlist", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    })
    setItems((prev) => prev.filter((row) => row.productId !== productId))
  }

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      ),
    [items]
  )

  return (
    <KontoShell>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Heart className="h-6 w-6 text-primary" />
            Merkliste
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gespeicherte Favoriten — direkt in den Warenkorb legen oder entfernen.
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Wird geladen…
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {!loading && sorted.length === 0 && !error && (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="text-sm font-medium">Noch keine Favoriten</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tippe im Shop auf das Herz-Icon, um Produkte zu speichern.
            </p>
            <Button asChild className="mt-4">
              <Link href="/shop">Zum Shop</Link>
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((row) => {
            const cover =
              row.product.images?.[0]?.trim() || "/placeholder.svg"
            return (
              <Card key={row.productId} className="overflow-hidden rounded-2xl border-border/50">
                <CardContent className="flex gap-4 p-4">
                  <Link
                    href={productHref(row.product)}
                    className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary/50"
                  >
                    <SafeProductImage
                      src={cover}
                      alt={row.product.name}
                      fill
                      sizes="96px"
                      className="object-contain p-2"
                    />
                  </Link>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Link href={productHref(row.product)} className="font-semibold hover:underline">
                      {row.product.name}
                    </Link>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      ab CHF {Number(row.product.price).toFixed(2)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          addToCart({
                            id: `${row.product.id}-${Date.now()}`,
                            name: row.product.name,
                            price: Number(row.product.price) || 0,
                            quantity: 1,
                            type: row.product.type,
                            leitbild: cover.startsWith("data:") ? cover : undefined,
                          })
                        }
                      >
                        <ShoppingBag className="mr-1 h-3.5 w-3.5" />
                        In den Warenkorb
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void remove(row.productId)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Entfernen
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </KontoShell>
  )
}
