"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { KontoShell } from "@/components/konto/konto-shell"
import type { CustomerOrderSummary } from "@/lib/konto/customer-orders"
import {
  formatOrderDate,
  OrderActions,
  OrderItemList,
  OrderStatusBadge,
  OrderStatusTimeline,
} from "@/components/konto/konto-order-parts"

export function KontoOrdersPage() {
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)

  useEffect(() => {
    void fetch("/api/customer/orders", { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/konto/login?next=/konto/bestellungen"
          return
        }
        const data = (await res.json()) as {
          orders?: CustomerOrderSummary[]
          error?: string
        }
        if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
        setOrders(data.orders ?? [])
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Fehler beim Laden")
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <KontoShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Meine Bestellungen</h1>
          <p className="text-sm text-muted-foreground">
            Alle Aufträge mit Produktdetails, Status und Rechnungsdownload
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

        {invoiceError && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {invoiceError}
          </p>
        )}

        {!loading && orders.length === 0 && !error && (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="text-sm font-medium">Keine Bestellungen gefunden</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bestellungen mit deiner Konto-E-Mail erscheinen automatisch hier.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.orderId} className="rounded-2xl border-border/50">
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold">{order.orderId}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatOrderDate(order.createdAt, "long")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums">
                      CHF {order.totalChf.toFixed(2)}
                    </p>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <OrderStatusBadge order={order} />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Zahlung: {order.paymentMethodLabel} · {order.itemCount} Position(en)
                </p>

                <OrderStatusTimeline order={order} />
                <OrderItemList order={order} />
                <OrderActions
                  order={order}
                  onInvoiceError={(message) => setInvoiceError(message)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </KontoShell>
  )
}
