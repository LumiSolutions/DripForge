"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PageCheckout } from "@/components/dripforge/views/page-checkout"
import { useCart } from "@/components/dripforge/cart-provider"
import { useShopNavigate } from "@/hooks/use-shop-navigate"
import { cn } from "@/lib/utils"

function CheckoutPageInner() {
  const navigate = useShopNavigate()
  const { cart, setCart } = useCart()
  const searchParams = useSearchParams()
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(
    null
  )
  const [checkoutNoticeVariant, setCheckoutNoticeVariant] = useState<
    "success" | "error"
  >("success")

  useEffect(() => {
    if (searchParams.get("order_success") === "1") {
      setCheckoutNoticeVariant("success")
      setOrderSuccessMessage(
        "Vielen Dank! Deine Zahlung war erfolgreich. Die Bestellung wird verarbeitet — KI-Credits werden nach Bestätigung gutgeschrieben."
      )
      setCart([])
      window.history.replaceState({}, "", "/checkout")
    }
    if (searchParams.get("payment_failed") === "1") {
      setCheckoutNoticeVariant("error")
      setOrderSuccessMessage(
        "Die TWINT-Zahlung konnte nicht abgeschlossen werden. Bitte versuche es erneut oder wähle eine andere Zahlungsart."
      )
      window.history.replaceState({}, "", "/checkout")
    }
  }, [searchParams, setCart])

  return (
    <>
      {orderSuccessMessage && (
        <div className="mx-auto max-w-4xl px-4 pt-4">
          <div
            role="status"
            className={cn(
              "rounded-xl border px-4 py-3 text-sm",
              checkoutNoticeVariant === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200"
            )}
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
          setCheckoutNoticeVariant("success")
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
    <Suspense
      fallback={
        <div className="py-24 text-center text-muted-foreground">
          Checkout wird geladen…
        </div>
      }
    >
      <CheckoutPageInner />
    </Suspense>
  )
}
