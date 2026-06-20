"use client"

import { useMemo } from "react"
import { Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  LOYALTY_POINT_PACKAGES,
  chfToLoyaltyPoints,
  loyaltyPointsToChf,
} from "@/lib/konto/loyalty-points-config"

export type CheckoutPointsPurchaseSelection = {
  packageId?: string
  customAmountChf?: number
  amountChf: number
  points: number
}

type CheckoutRewardPointsProps = {
  loggedIn: boolean
  loyaltyLoading: boolean
  loyaltyPoints: number
  pointsToRedeem: number
  maxPoints: number
  effectivePoints: number
  pointsDiscountChf: number
  onPointsToRedeemChange: (value: number) => void
  selectedPackage: string | null
  onSelectedPackageChange: (value: string | null) => void
  customAmount: string
  onCustomAmountChange: (value: string) => void
}

export function resolveCheckoutPointsPurchaseSelection(
  selectedPackage: string | null,
  customAmount: string
): CheckoutPointsPurchaseSelection | null {
  if (!selectedPackage) return null

  if (selectedPackage === "custom") {
    const amountChf = Math.round(Number(customAmount) * 100) / 100
    if (!Number.isFinite(amountChf) || amountChf < 1 || amountChf > 500) {
      return null
    }
    const points = chfToLoyaltyPoints(amountChf)
    if (points <= 0) return null
    return { customAmountChf: amountChf, amountChf, points }
  }

  const pkg = LOYALTY_POINT_PACKAGES.find((entry) => entry.id === selectedPackage)
  if (!pkg) return null
  return { packageId: pkg.id, amountChf: pkg.priceChf, points: pkg.points }
}

export function CheckoutRewardPointsSection({
  loggedIn,
  loyaltyLoading,
  loyaltyPoints,
  pointsToRedeem,
  maxPoints,
  effectivePoints,
  pointsDiscountChf,
  onPointsToRedeemChange,
  selectedPackage,
  onSelectedPackageChange,
  customAmount,
  onCustomAmountChange,
}: CheckoutRewardPointsProps) {
  const purchasePreview = useMemo(
    () => resolveCheckoutPointsPurchaseSelection(selectedPackage, customAmount),
    [selectedPackage, customAmount]
  )

  const togglePackage = (id: string) => {
    onSelectedPackageChange(selectedPackage === id ? null : id)
  }

  return (
    <div className="mb-4 space-y-4">
      {loggedIn && !loyaltyLoading && (
        <div className="space-y-2 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Coins className="h-4 w-4 text-amber-600" />
            Punkte einlösen
          </div>
          {loyaltyPoints > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">
                Verfügbar: {loyaltyPoints} Punkte (CHF{" "}
                {loyaltyPointsToChf(loyaltyPoints).toFixed(2)})
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  max={maxPoints}
                  value={pointsToRedeem || ""}
                  onChange={(e) =>
                    onPointsToRedeemChange(
                      Math.max(0, Math.min(maxPoints, Number(e.target.value) || 0))
                    )
                  }
                  placeholder="0"
                  className="bg-background/80"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onPointsToRedeemChange(maxPoints)}
                  disabled={maxPoints <= 0}
                >
                  Max
                </Button>
              </div>
              {effectivePoints > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  − CHF {pointsDiscountChf.toFixed(2)} Rabatt
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Noch keine Punkte vorhanden. Kaufe unten Punkte oder sammle sie beim
              Einkauf.
            </p>
          )}
        </div>
      )}

      {loggedIn && !loyaltyLoading && (
        <div className="space-y-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Coins className="h-4 w-4 text-primary" />
            Punkte kaufen
          </div>
          <p className="text-xs text-muted-foreground">
            Der Betrag wird auf diese Bestellung aufgeschlagen und nach Zahlung
            gutgeschrieben.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {LOYALTY_POINT_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => togglePackage(pkg.id)}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                  selectedPackage === pkg.id
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-primary/40"
                }`}
              >
                <p className="font-medium">{pkg.label}</p>
                <p className="text-xs text-muted-foreground">
                  CHF {pkg.priceChf.toFixed(2)}
                </p>
              </button>
            ))}
            <button
              type="button"
              onClick={() => togglePackage("custom")}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                selectedPackage === "custom"
                  ? "border-primary bg-primary/10"
                  : "border-border/60 hover:border-primary/40"
              }`}
            >
              <p className="font-medium">Wunschbetrag</p>
              <p className="text-xs text-muted-foreground">1–500 CHF</p>
            </button>
          </div>
          {selectedPackage === "custom" && (
            <div className="space-y-1">
              <Label htmlFor="checkoutCustomPoints" className="text-xs">
                Betrag in CHF
              </Label>
              <Input
                id="checkoutCustomPoints"
                type="number"
                min={1}
                max={500}
                step={0.1}
                value={customAmount}
                onChange={(e) => onCustomAmountChange(e.target.value)}
                className="bg-background/80"
              />
            </div>
          )}
          {purchasePreview && (
            <p className="text-xs text-primary">
              + CHF {purchasePreview.amountChf.toFixed(2)} ({purchasePreview.points}{" "}
              Punkte)
            </p>
          )}
        </div>
      )}

      {!loggedIn && !loyaltyLoading && (
        <p className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-xs text-muted-foreground">
          Melde dich an, um Treuepunkte einzulösen oder zu kaufen.
        </p>
      )}
    </div>
  )
}
