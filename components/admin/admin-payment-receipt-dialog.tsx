"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { StoredOrder } from "@/lib/admin/types"
import { getAccountingAccountConfig } from "@/lib/accounting/account-config"
import type { PaymentSettlementAccount } from "@/lib/accounting/order-journal"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function customerLabel(order: StoredOrder): string {
  const name = [order.billing?.firstName, order.billing?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim()
  return name || order.billing?.email || order.orderId
}

export type AdminPaymentReceiptDialogProps = {
  order: StoredOrder | null
  open: boolean
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (payload: {
    orderId: string
    settlementAccount: PaymentSettlementAccount
    paymentDate: string
  }) => void | Promise<void>
}

/**
 * Dialog für manuellen Zahlungseingang (Rechnung / Bar):
 * Konto Bank vs. Kasse + Zahlungsdatum.
 */
export function AdminPaymentReceiptDialog({
  order,
  open,
  busy = false,
  onOpenChange,
  onConfirm,
}: AdminPaymentReceiptDialogProps) {
  const accounts = getAccountingAccountConfig()
  const [settlement, setSettlement] =
    useState<PaymentSettlementAccount>("bank")
  const [paymentDate, setPaymentDate] = useState(todayIsoDate)

  useEffect(() => {
    if (open) {
      setSettlement(order?.paymentMethod === "cash" ? "cash" : "bank")
      setPaymentDate(todayIsoDate())
    }
  }, [open, order?.paymentMethod, order?.orderId])

  const total =
    order?.totals?.total != null
      ? `CHF ${Number(order.totals.total).toFixed(2)}`
      : "—"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zahlungseingang bestätigen</DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-4">
            <p className={cn("text-sm", adminUi.muted)}>
              Bestellung{" "}
              <span className="font-mono font-medium text-foreground">
                {order.orderId}
              </span>{" "}
              — {customerLabel(order)}
              <br />
              Betrag: <span className="font-medium text-foreground">{total}</span>
            </p>

            <fieldset className="space-y-2">
              <legend className={cn("text-sm font-medium", adminUi.label)}>
                Zahlungseingangs-Konto
              </legend>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-sm">
                <input
                  type="radio"
                  name="settlementAccount"
                  value="bank"
                  checked={settlement === "bank"}
                  onChange={() => setSettlement("bank")}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="font-medium">Bankkonto / Raiffeisen</span>
                  <span className={cn("mt-0.5 block text-xs", adminUi.muted)}>
                    Soll: {accounts.bank} · Haben: {accounts.receivable}{" "}
                    Forderungen
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-sm">
                <input
                  type="radio"
                  name="settlementAccount"
                  value="cash"
                  checked={settlement === "cash"}
                  onChange={() => setSettlement("cash")}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="font-medium">Bar / Kasse</span>
                  <span className={cn("mt-0.5 block text-xs", adminUi.muted)}>
                    Soll: {accounts.cash} · Haben: {accounts.receivable}{" "}
                    Forderungen
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="paymentDate" className={adminUi.label}>
                Zahlungsdatum
              </Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className={adminUi.input}
                max={todayIsoDate()}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={!order || busy || !paymentDate}
            className={adminUi.primaryBtn}
            onClick={() => {
              if (!order) return
              void onConfirm({
                orderId: order.orderId,
                settlementAccount: settlement,
                paymentDate,
              })
            }}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gebucht…
              </>
            ) : (
              "Zahlung verbuchen"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
