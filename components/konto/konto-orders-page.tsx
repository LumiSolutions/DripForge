"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ChevronDown,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { KontoShell } from "@/components/konto/konto-shell"
import type { CustomerOrderSummary } from "@/lib/konto/customer-orders"
import {
  formatOrderDate,
  OrderActions,
  OrderItemList,
  OrderStatusBadge,
  OrderStatusTimeline,
} from "@/components/konto/konto-order-parts"
import { cn } from "@/lib/utils"

function manufacturingKind(order: CustomerOrderSummary): "3d" | "laser" | "hybrid" {
  const types = new Set(order.items.map((item) => item.type))
  if (types.has("3d") && types.has("laser")) return "hybrid"
  if (types.has("laser")) return "laser"
  return "3d"
}

function ManufacturingBadge({ kind }: { kind: "3d" | "laser" | "hybrid" }) {
  if (kind === "hybrid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
        <Printer className="h-3 w-3" />
        <Zap className="h-3 w-3" />
        Hybrid
      </span>
    )
  }
  if (kind === "laser") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
        <Zap className="h-3 w-3" />
        Laser
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:text-sky-200">
      <Printer className="h-3 w-3" />
      3D-Druck
    </span>
  )
}

type SortKey = "date-desc" | "date-asc" | "total-desc" | "total-asc" | "id"

export function KontoOrdersPage() {
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("date-desc")

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

  const statusOptions = useMemo(() => {
    const set = new Set(orders.map((o) => o.customerStatusLabel))
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b, "de"))]
  }, [orders])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = orders.filter((order) => {
      if (statusFilter !== "all" && order.customerStatusLabel !== statusFilter) {
        return false
      }
      if (!q) return true
      return (
        order.orderId.toLowerCase().includes(q) ||
        order.customerStatusLabel.toLowerCase().includes(q) ||
        order.paymentMethodLabel.toLowerCase().includes(q)
      )
    })

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "date-asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case "total-desc":
          return b.totalChf - a.totalChf
        case "total-asc":
          return a.totalChf - b.totalChf
        case "id":
          return a.orderId.localeCompare(b.orderId, "de")
        case "date-desc":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })
    return list
  }, [orders, query, statusFilter, sortKey])

  return (
    <KontoShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Meine Bestellungen</h1>
          <p className="text-sm text-muted-foreground">
            Kompakte Übersicht — Details per Klick aufklappen
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche Bestellnr., Status…"
              className="pl-9"
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "Alle Status" : status}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="date-desc">Datum (neueste)</option>
            <option value="date-asc">Datum (älteste)</option>
            <option value="total-desc">Preis (hoch)</option>
            <option value="total-asc">Preis (tief)</option>
            <option value="id">Bestellnummer</option>
          </select>
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

        {!loading && filtered.length === 0 && !error && (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="text-sm font-medium">Keine Bestellungen gefunden</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bestellungen mit deiner Konto-E-Mail erscheinen automatisch hier.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((order) => {
            const open = Boolean(expanded[order.orderId])
            const kind = manufacturingKind(order)
            return (
              <Card key={order.orderId} className="rounded-2xl border-border/50">
                <CardContent className="p-4 sm:p-5">
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 text-left"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [order.orderId]: !prev[order.orderId],
                      }))
                    }
                    aria-expanded={open}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-semibold">{order.orderId}</p>
                        <ManufacturingBadge kind={kind} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatOrderDate(order.createdAt, "long")} ·{" "}
                        {order.paymentMethodLabel}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold tabular-nums sm:text-lg">
                        CHF {order.totalChf.toFixed(2)}
                      </p>
                      <div className="mt-1 flex justify-end">
                        <OrderStatusBadge order={order} />
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        "mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180"
                      )}
                    />
                  </button>

                  {open && (
                    <div className="mt-4 space-y-4 border-t border-border/50 pt-4">
                      <OrderStatusTimeline order={order} />
                      <OrderItemList order={order} />
                      <OrderActions
                        order={order}
                        onInvoiceError={(message) => setInvoiceError(message)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <Link href="/konto/bestellvorschlag" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
            <RefreshCw className="h-3.5 w-3.5" />
            Bestellvorschlag
          </Link>
          <span>·</span>
          <Link href="/konto/belege" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
            <FileText className="h-3.5 w-3.5" />
            Belege
          </Link>
        </div>
      </div>
    </KontoShell>
  )
}
