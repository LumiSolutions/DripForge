"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Coins, CreditCard, Loader2, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KontoShell } from "@/components/konto/konto-shell"
import {
  LOYALTY_POINT_PACKAGES,
  loyaltyPointsToChf,
} from "@/lib/konto/loyalty-points-config"
import { useCustomerLoyaltyPoints } from "@/hooks/use-customer-loyalty-points"
import { useRewardPointsEnabled } from "@/hooks/use-reward-points-enabled"

export function KontoPointsPage() {
  const searchParams = useSearchParams()
  const { loggedIn, loading, loyaltyPoints, loyaltyBalanceChf, refresh } =
    useCustomerLoyaltyPoints()
  const rewardPointsEnabled = useRewardPointsEnabled()
  const [customAmount, setCustomAmount] = useState("10")
  const [selectedPackage, setSelectedPackage] = useState<string | null>("100")
  const [paymentMethod, setPaymentMethod] = useState<"card" | "twint">("card")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get("purchase_success") === "1") {
      setNotice("Zahlung erfolgreich — deine Punkte werden in Kürze gutgeschrieben.")
      void refresh()
    } else if (searchParams.get("payment_failed") === "1") {
      setError("Zahlung fehlgeschlagen. Bitte erneut versuchen.")
    } else if (searchParams.get("canceled") === "1") {
      setNotice("Kauf abgebrochen.")
    }
  }, [searchParams, refresh])

  const startPurchase = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const endpoint =
        paymentMethod === "twint"
          ? "/api/checkout/points/twint"
          : "/api/checkout/points"

      const body =
        selectedPackage === "custom"
          ? {
              paymentMethod,
              customAmountChf: Number(customAmount),
            }
          : {
              paymentMethod,
              packageId: selectedPackage ?? "100",
            }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? "Checkout konnte nicht gestartet werden.")
        return
      }
      window.location.href = data.url
    } catch {
      setError("Verbindungsfehler. Bitte später erneut versuchen.")
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <KontoShell>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Punkte werden geladen…
        </div>
      </KontoShell>
    )
  }

  if (rewardPointsEnabled === false) {
    return (
      <KontoShell>
        <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          Das Treuepunkte-System ist derzeit deaktiviert.
        </p>
      </KontoShell>
    )
  }

  if (!loggedIn) {
    return (
      <KontoShell>
        <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          Bitte melde dich an, um Treuepunkte zu verwalten.
        </p>
      </KontoShell>
    )
  }

  return (
    <KontoShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Treuepunkte</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            1 Punkt = 0.10 CHF Guthaben. Sammle 10 % deines Einkaufs als Punkte.
          </p>
        </div>

        <Card className="rounded-2xl border-primary/25 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-4 p-6">
            <Coins className="h-10 w-10 text-primary" />
            <div>
              <p className="text-3xl font-bold tabular-nums">{loyaltyPoints} Punkte</p>
              <p className="text-sm text-muted-foreground">
                = CHF {loyaltyBalanceChf.toFixed(2)} Guthaben
              </p>
            </div>
          </CardContent>
        </Card>

        {notice && (
          <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-300">
            {notice}
          </p>
        )}
        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Punkte kaufen</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {LOYALTY_POINT_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedPackage(pkg.id)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  selectedPackage === pkg.id
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-primary/40"
                }`}
              >
                <p className="font-semibold">{pkg.label}</p>
                <p className="text-sm text-muted-foreground">
                  CHF {pkg.priceChf.toFixed(2)}
                </p>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedPackage("custom")}
              className={`rounded-xl border p-4 text-left transition-colors ${
                selectedPackage === "custom"
                  ? "border-primary bg-primary/10"
                  : "border-border/60 hover:border-primary/40"
              }`}
            >
              <p className="font-semibold">Wunschbetrag</p>
              <p className="text-sm text-muted-foreground">Individuell aufladen</p>
            </button>
          </div>

          {selectedPackage === "custom" && (
            <div className="max-w-xs space-y-2">
              <Label htmlFor="customAmount">Betrag in CHF</Label>
              <Input
                id="customAmount"
                type="number"
                min={1}
                max={500}
                step={0.1}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ergibt ca. {Math.floor(Number(customAmount || 0) / 0.1)} Punkte
                (CHF {loyaltyPointsToChf(Math.floor(Number(customAmount || 0) / 0.1)).toFixed(2)})
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod("card")}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm ${
                paymentMethod === "card" ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Karte (Stripe)
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("twint")}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm ${
                paymentMethod === "twint" ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <QrCode className="h-4 w-4" />
              TWINT
            </button>
          </div>

          <Button onClick={() => void startPurchase()} disabled={busy}>
            {busy ? "Wird weitergeleitet…" : "Jetzt Punkte kaufen"}
          </Button>
        </section>
      </div>
    </KontoShell>
  )
}
