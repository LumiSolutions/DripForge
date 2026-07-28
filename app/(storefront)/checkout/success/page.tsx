"use client"

import { Suspense, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Package, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/components/dripforge/cart-provider"

function CheckoutSuccessInner() {
  const searchParams = useSearchParams()
  const { setCart } = useCart()
  const sessionId = searchParams.get("session_id")
  const orderId = searchParams.get("order_id")

  useEffect(() => {
    setCart([])
  }, [setCart])

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-emerald-500" />
      <h1 className="text-3xl font-bold">Vielen Dank für Ihre Bestellung!</h1>
      <p className="mt-4 text-muted-foreground">
        Wir haben Ihre Bestellung erhalten und mit der Verarbeitung begonnen.
      </p>
      {orderId ? (
        <div className="mx-auto mt-6 max-w-sm rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bestell-ID
          </p>
          <p className="mt-1 font-mono text-sm font-semibold">{orderId}</p>
        </div>
      ) : sessionId ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Referenz: {sessionId.slice(0, 24)}…
        </p>
      ) : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/konto/bestellungen">
            <Package className="mr-2 h-4 w-4" />
            Zu meinen Bestellungen
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/shop">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Weiter einkaufen
          </Link>
        </Button>
      </div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-muted-foreground">
          Wird geladen…
        </div>
      }
    >
      <CheckoutSuccessInner />
    </Suspense>
  )
}
