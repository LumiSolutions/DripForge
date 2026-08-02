"use client"

import Link from "next/link"
import { CheckCircle2, Package, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { OrderThanksFromSettings } from "@/components/dripforge/order-thanks-animation"
import type { PaymentMethodId } from "@/lib/dripforge/checkout-config"

type CheckoutSuccessModalProps = {
  open: boolean
  orderId: string
  onContinueShopping: () => void
  /** Wenn false, nur «Weiter einkaufen» (z. B. Gast ohne Konto-Link). */
  showOrdersLink?: boolean
  /** Zahlungsart — steuert Vorkasse-Hinweis (Rechnung / TWINT). */
  paymentMethod?: PaymentMethodId
}

export function CheckoutSuccessModal({
  open,
  orderId,
  onContinueShopping,
  showOrdersLink = true,
  paymentMethod,
}: CheckoutSuccessModalProps) {
  const isPrepaid =
    paymentMethod === "invoice" || paymentMethod === "twint"

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onContinueShopping()}>
      <DialogContent className="z-[200] max-w-md border-border/60 sm:rounded-2xl">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          {open ? (
            <OrderThanksFromSettings
              className="mb-3 w-full"
              active={open}
              compact
            />
          ) : null}
          <DialogTitle className="text-2xl">
            {isPrepaid
              ? "Bestellung erhalten — wartet auf Zahlung"
              : "Vielen Dank für Ihre Bestellung!"}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            {isPrepaid
              ? "Dies ist die Bestätigung deines Bestelleingangs. Da es sich um Vorkasse handelt, wird die Bestellung erst nach Zahlungseingang bearbeitet und versendet."
              : "Wir haben Ihre Bestellung erhalten und mit der Verarbeitung begonnen."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bestell-ID
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">
            {orderId}
          </p>
        </div>

        {isPrepaid ? (
          <p className="text-center text-sm font-medium text-foreground">
            Hinweis: Die Bearbeitung und der Versand deiner Bestellung erfolgen
            direkt nach Erhalt des Zahlungseingangs.
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          {showOrdersLink ? (
            <Button asChild className="flex-1 bg-primary hover:bg-primary/90">
              <Link href="/konto/bestellungen">
                <Package className="mr-2 h-4 w-4" />
                Zu meinen Bestellungen
              </Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant={showOrdersLink ? "outline" : "default"}
            className="flex-1"
            onClick={onContinueShopping}
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            Weiter einkaufen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
