"use client"

import { Suspense, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/components/dripforge/cart-provider"

function CheckoutSuccessInner() {
  const searchParams = useSearchParams()
  const { setCart } = useCart()
  const sessionId = searchParams.get("session_id")

  useEffect(() => {
    setCart([])
  }, [setCart])

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-emerald-500" />
      <h1 className="text-3xl font-bold">Zahlung erfolgreich</h1>
      <p className="mt-4 text-muted-foreground">
        Vielen Dank für deine Bestellung bei DripForge. Wir haben deine Zahlung
        erhalten und bearbeiten deinen Auftrag.
      </p>
      {sessionId ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Referenz: {sessionId.slice(0, 24)}…
        </p>
      ) : null}
      <Button asChild className="mt-8 bg-primary hover:bg-primary/90">
        <Link href="/">Zur Startseite</Link>
      </Button>
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
