"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Package, Palette } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { KontoShell } from "@/components/konto/konto-shell"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import type { CustomerOrderSummary } from "@/lib/konto/customer-orders"

type Account = {
  email: string
  firstName: string
  lastName: string
  kundennummer?: string
}

export function KontoDashboard() {
  const { t } = useSiteTexts()
  const [account, setAccount] = useState<Account | null>(null)
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const [meRes, ordersRes] = await Promise.all([
          fetch("/api/konto/me", { cache: "no-store" }),
          fetch("/api/konto/orders", { cache: "no-store" }),
        ])
        if (meRes.ok) {
          const me = (await meRes.json()) as { account: Account }
          setAccount(me.account)
        }
        if (ordersRes.ok) {
          const data = (await ordersRes.json()) as { orders: CustomerOrderSummary[] }
          setOrders(data.orders ?? [])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return (
      <KontoShell>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Konto wird geladen…
        </div>
      </KontoShell>
    )
  }

  const name = account
    ? `${account.firstName} ${account.lastName}`.trim()
    : "Kunde"

  return (
    <KontoShell accountName={name}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">{t("konto_welcome_title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("konto_welcome_subtitle")},{" "}
            <span className="font-medium text-foreground">{name}</span>
          </p>
          {account?.kundennummer ? (
            <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("konto_customer_number_label")}
              </span>
              <span className="font-mono text-base font-bold tracking-wide text-primary">
                {account.kundennummer}
              </span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="flex items-center gap-4 p-6">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold tabular-nums">{orders.length}</p>
                <p className="text-sm text-muted-foreground">Bestellungen</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="flex items-center gap-4 p-6">
              <Palette className="h-8 w-8 text-cyan-500" />
              <div>
                <p className="text-sm font-medium">Meine Designs</p>
                <Link
                  href="/konto/designs"
                  className="text-sm text-primary hover:underline"
                >
                  Designs verwalten →
                </Link>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50 sm:col-span-2">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div>
                <p className="font-medium">Profil &amp; Adressen</p>
                <p className="text-sm text-muted-foreground">
                  Checkout-Daten pflegen und speichern
                </p>
              </div>
              <Link
                href="/konto/profil"
                className="text-sm font-medium text-primary hover:underline"
              >
                Profil bearbeiten →
              </Link>
            </CardContent>
          </Card>
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Letzte Bestellungen</h2>
            <Link href="/konto/bestellungen" className="text-sm text-primary hover:underline">
              Alle anzeigen
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              Noch keine Bestellungen mit dieser E-Mail-Adresse.
            </p>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map((order) => (
                <Card key={order.orderId} className="rounded-xl border-border/50">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-mono text-sm font-medium">{order.orderId}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("de-CH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(order.createdAt))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">
                        {order.productionStatusLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        CHF {order.totalChf.toFixed(2)} · {order.statusLabel}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <p className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {t("konto_support_hint")}
        </p>
      </div>
    </KontoShell>
  )
}
