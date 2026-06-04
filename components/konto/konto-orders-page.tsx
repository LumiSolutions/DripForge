"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { KontoShell } from "@/components/konto/konto-shell"
import type { CustomerOrderSummary } from "@/lib/konto/customer-orders"

export function KontoOrdersPage() {
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch("/api/konto/orders", { cache: "no-store" })
      .then(async (res) => {
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
            Produktionsstatus aus unserem Werkstatt-Cockpit
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Wird geladen…
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        {!loading && orders.length === 0 && (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            Keine Bestellungen gefunden.
          </p>
        )}

        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.orderId} className="rounded-2xl border-border/50">
              <CardContent className="space-y-3 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold">{order.orderId}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("de-CH", {
                        dateStyle: "long",
                        timeStyle: "short",
                      }).format(new Date(order.createdAt))}
                    </p>
                  </div>
                  <p className="text-lg font-bold tabular-nums">
                    CHF {order.totalChf.toFixed(2)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    Produktion: {order.productionStatusLabel}
                  </Badge>
                  <Badge variant="outline">Shop: {order.statusLabel}</Badge>
                  <Badge variant="outline">{order.itemCount} Position(en)</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Zahlung: {order.paymentMethodLabel}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </KontoShell>
  )
}
