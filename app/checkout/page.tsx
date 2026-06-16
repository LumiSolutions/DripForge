"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PageCheckout } from "@/components/dripforge/views/page-checkout"
import { useCart } from "@/components/dripforge/cart-provider"
import { StorefrontLayoutWrapper } from "@/components/dripforge/storefront-layout-wrapper"
import { useShopNavigate } from "@/hooks/use-shop-navigate"

function CheckoutPageInner() {
  const navigate = useShopNavigate()
  const { cart, setCart } = useCart()
  const searchParams = useSearchParams()
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(
    null
  )

  useEffect(() => {
    if (searchParams.get("order_success") === "1") {
      setOrderSuccessMessage(
        "Vielen Dank! Deine Zahlung war erfolgreich. Die Bestellung wird verarbeitet — KI-Credits werden nach Bestätigung gutgeschrieben."
      )
      setCart([])
      window.history.replaceState({}, "", "/checkout")
    }
  }, [searchParams, setCart])

  return (
    <>
      {orderSuccessMessage && (
        <div className="mx-auto max-w-4xl px-4 pt-4">
          <div
            role="status"
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
          >
            <p>{orderSuccessMessage}</p>
            <button
              type="button"
              onClick={() => setOrderSuccessMessage(null)}
              className="mt-2 text-xs font-medium underline underline-offset-2"
            >
              Schliessen
            </button>
          </div>
        </div>
      )}
      <PageCheckout
        setCurrentView={navigate}
        cart={cart}
        onOrderComplete={() => {
          setCart([])
          setOrderSuccessMessage(
            "Vielen Dank! Deine Bestellung wurde erfolgreich übermittelt. Bei «Kauf auf Rechnung» erhältst du die Rechnung per E-Mail, sobald SMTP im Portal konfiguriert ist."
          )
        }}
      />
    </>
  )
}

export default function CheckoutPage() {
  return (
    <StorefrontLayoutWrapper>
      <Suspense
        fallback={
          <div className="py-24 text-center text-muted-foreground">
            Checkout wird geladen…
          </div>
        }
      >
        <CheckoutPageInner />
      </Suspense>
    </StorefrontLayoutWrapper>
  )
}
