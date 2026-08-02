"use client"

import { useEffect, useState } from "react"
import { Loader2, ShoppingBag, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { KontoShell } from "@/components/konto/konto-shell"
import { useCart } from "@/components/dripforge/cart-provider"
import type { CustomerOffer } from "@/lib/konto/customer-offer-types"
import type { CartItem } from "@/lib/dripforge/types"

export function KontoAngebotePage() {
  const { addToCart } = useCart()
  const [offers, setOffers] = useState<CustomerOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/konto/offers", {
          cache: "no-store",
          credentials: "include",
        })
        if (res.status === 401) {
          window.location.href = "/konto/login?next=/konto/angebote"
          return
        }
        const data = (await res.json()) as {
          offers?: CustomerOffer[]
          error?: string
        }
        if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
        if (!cancelled) setOffers(data.offers ?? [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Fehler")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleAddToCart = async (offer: CustomerOffer) => {
    setAddingId(offer.id)
    setSuccessId(null)
    try {
      const res = await fetch(
        `/api/konto/offers/${encodeURIComponent(offer.id)}/accept`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markAccepted: false }),
        }
      )
      const data = (await res.json()) as {
        cartItem?: CartItem
        error?: string
      }
      const item = data.cartItem ?? offer.cartItem
      addToCart({
        ...item,
        id: `${item.id}-${Date.now()}`,
        quantity: Math.max(1, Number(item.quantity) || 1),
      })
      setSuccessId(offer.id)
      if (res.ok) {
        /* optional: keep offer active so customer can re-add */
      }
    } catch {
      addToCart({
        ...offer.cartItem,
        id: `${offer.cartItem.id}-${Date.now()}`,
      })
      setSuccessId(offer.id)
    } finally {
      setAddingId(null)
    }
  }

  return (
    <KontoShell>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Tag className="h-6 w-6 text-primary" />
            Meine Angebote / Entwürfe
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vom Team vorbereitete Angebote und Entwürfe — direkt in den Warenkorb
            legen.
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

        {!loading && offers.length === 0 && !error && (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="text-sm font-medium">Keine aktiven Angebote</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sobald wir einen Entwurf für Sie vorbereiten, erscheint er hier.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {offers.map((offer) => {
            const preview = offer.previewUrl?.trim() || offer.cartItem.leitbild
            const price =
              offer.priceChf ??
              Number(offer.cartItem.price) ??
              0
            return (
              <Card
                key={offer.id}
                className="overflow-hidden rounded-2xl border-border/50"
              >
                <CardContent className="flex gap-4 p-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary/50">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview}
                        alt=""
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Tag className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="font-semibold">{offer.title}</p>
                    {offer.description ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {offer.description}
                      </p>
                    ) : null}
                    <p className="text-sm tabular-nums text-muted-foreground">
                      CHF {Number(price).toFixed(2)} ·{" "}
                      {offer.cartItem.type === "laser" ? "Laser" : "3D"}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      disabled={addingId === offer.id}
                      onClick={() => void handleAddToCart(offer)}
                    >
                      {addingId === offer.id ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShoppingBag className="mr-1 h-3.5 w-3.5" />
                      )}
                      {successId === offer.id
                        ? "Im Warenkorb"
                        : "In den Warenkorb"}
                    </Button>
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
