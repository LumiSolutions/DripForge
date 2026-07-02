"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2, Package, Palette, Coins, MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { KontoShell } from "@/components/konto/konto-shell"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { useRewardPointsEnabled } from "@/hooks/use-reward-points-enabled"
import type { CustomerOrderSummary } from "@/lib/konto/customer-orders"
import type { CustomerProfileResponse } from "@/lib/konto/customer-profile-service"
import {
  formatOrderDate,
  OrderStatusBadge,
} from "@/components/konto/konto-order-parts"

export function KontoDashboard() {
  const rewardPointsEnabled = useRewardPointsEnabled()
  const [profile, setProfile] = useState<CustomerProfileResponse | null>(null)
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([])
  const [designCount, setDesignCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [profileRes, ordersRes, designsRes] = await Promise.all([
          fetch("/api/customer/profile", { cache: "no-store", credentials: "include" }),
          fetch("/api/customer/orders", { cache: "no-store", credentials: "include" }),
          fetch("/api/konto/designs", { cache: "no-store", credentials: "include" }),
        ])

        if (profileRes.status === 401 || ordersRes.status === 401) {
          window.location.href = "/konto/login?next=/konto"
          return
        }

        if (profileRes.ok) {
          const data = (await profileRes.json()) as { profile: CustomerProfileResponse }
          setProfile(data.profile)
        } else {
          throw new Error("Profil konnte nicht geladen werden.")
        }

        if (ordersRes.ok) {
          const data = (await ordersRes.json()) as { orders: CustomerOrderSummary[] }
          setOrders(data.orders ?? [])
        }

        if (designsRes.ok) {
          const data = (await designsRes.json()) as { designs?: unknown[] }
          setDesignCount(data.designs?.length ?? 0)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Konto konnte nicht geladen werden.")
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

  if (error) {
    return (
      <KontoShell>
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      </KontoShell>
    )
  }

  const name = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : "Kunde"

  const recentOrders = orders.slice(0, 2)

  return (
    <KontoShell accountName={name}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold"><SiteText k="konto_welcome_title" /></h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <SiteText k="konto_welcome_subtitle" />,{" "}
            <span className="font-medium text-foreground">{name}</span>
          </p>
          {profile?.kundennummer ? (
            <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <SiteText k="konto_customer_number_label" />
              </span>
              <span className="font-mono text-base font-bold tracking-wide text-primary">
                {profile.kundennummer}
              </span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/konto/bestellungen" className="group block">
            <Card className="h-full rounded-2xl border-border/50 transition-colors group-hover:border-primary/40">
              <CardContent className="flex items-center justify-between gap-4 p-6">
                <div className="flex items-center gap-4">
                  <Package className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{orders.length}</p>
                    <p className="text-sm text-muted-foreground">Bestellungen</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </CardContent>
            </Card>
          </Link>

          {rewardPointsEnabled !== false && (
            <Link href="/konto/punkte" className="group block">
              <Card className="h-full rounded-2xl border-primary/25 bg-primary/5 transition-colors group-hover:border-primary/50">
                <CardContent className="flex items-center justify-between gap-4 p-6">
                  <div className="flex items-center gap-4">
                    <Coins className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold tabular-nums">
                        {profile?.loyaltyPoints ?? 0} Punkte
                      </p>
                      <p className="text-sm text-muted-foreground">
                        = CHF {(profile?.loyaltyBalanceChf ?? 0).toFixed(2)} Guthaben
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </CardContent>
              </Card>
            </Link>
          )}

          <Link href="/konto/designs" className="group block">
            <Card className="h-full rounded-2xl border-border/50 transition-colors group-hover:border-primary/40">
              <CardContent className="flex items-center justify-between gap-4 p-6">
                <div className="flex items-center gap-4">
                  <Palette className="h-8 w-8 text-cyan-500" />
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{designCount}</p>
                    <p className="text-sm text-muted-foreground">Meine Designs</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/konto/profil" className="group block sm:col-span-2">
            <Card className="rounded-2xl border-border/50 transition-colors group-hover:border-primary/40">
              <CardContent className="flex items-center justify-between gap-4 p-6">
                <div className="flex items-center gap-4">
                  <MapPin className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">Profil &amp; Adressen</p>
                    <p className="text-sm text-muted-foreground">
                      Checkout-Daten pflegen und speichern
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </CardContent>
            </Card>
          </Link>
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Letzte Bestellungen</h2>
            {orders.length > 0 && (
              <Link href="/konto/bestellungen" className="text-sm text-primary hover:underline">
                Alle anzeigen
              </Link>
            )}
          </div>
          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-10 text-center">
              <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-medium text-foreground">Noch keine Bestellungen</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sobald du im Shop bestellst, erscheinen deine Aufträge hier — inklusive
                Produktionsstatus und Rechnungsdownload.
              </p>
              <Link
                href="/shop"
                className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
              >
                Zum Shop →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Card key={order.orderId} className="rounded-xl border-border/50">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-medium">{order.orderId}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatOrderDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <OrderStatusBadge order={order} />
                        <p className="mt-1 text-sm font-semibold tabular-nums">
                          CHF {order.totalChf.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {order.itemCount} Position(en) · {order.paymentMethodLabel}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <p className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <SiteText k="konto_support_hint" />
        </p>
      </div>
    </KontoShell>
  )
}
