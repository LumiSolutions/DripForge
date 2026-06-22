"use client"

import Link from "next/link"
import { Download, LifeBuoy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CustomerOrderSummary } from "@/lib/konto/customer-orders"

export function OrderStatusBadge({ order }: { order: CustomerOrderSummary }) {
  const tone =
    order.status === "storniert"
      ? "border-red-500/40 text-red-600 dark:text-red-400"
      : order.status === "versendet"
        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
        : "border-primary/40 text-primary"

  return (
    <Badge variant="outline" className={tone}>
      {order.customerStatusLabel}
    </Badge>
  )
}

export function OrderItemList({ order }: { order: CustomerOrderSummary }) {
  return (
    <div className="space-y-3 border-t border-border/50 pt-4">
      {order.items.map((item) => (
        <div key={item.id} className="flex gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted/40">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] uppercase text-muted-foreground">
                {item.type}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-snug">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {item.quantity}× CHF {item.unitPriceChf.toFixed(2)}
            </p>
            {item.options.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {item.options.map((option) => (
                  <li key={option}>{option}</li>
                ))}
              </ul>
            )}
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            CHF {item.lineTotalChf.toFixed(2)}
          </p>
        </div>
      ))}
    </div>
  )
}

export function OrderActions({
  order,
  onInvoiceError,
}: {
  order: CustomerOrderSummary
  onInvoiceError?: (message: string) => void
}) {
  const handleInvoiceDownload = async () => {
    try {
      const res = await fetch(
        `/api/customer/invoices/${encodeURIComponent(order.orderId)}`,
        { credentials: "include" }
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        onInvoiceError?.(data.error ?? "Rechnung konnte nicht geladen werden.")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `Rechnung-${order.orderId}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      onInvoiceError?.("Rechnung konnte nicht geladen werden.")
    }
  }

  return (
    <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
      <Button type="button" size="sm" variant="outline" onClick={() => void handleInvoiceDownload()}>
        <Download className="mr-2 h-4 w-4" />
        Rechnung herunterladen (PDF)
      </Button>
      <Button type="button" size="sm" variant="ghost" asChild>
        <Link href={`/kontakt?order=${encodeURIComponent(order.orderId)}`}>
          <LifeBuoy className="mr-2 h-4 w-4" />
          Support kontaktieren
        </Link>
      </Button>
    </div>
  )
}

export function formatOrderDate(iso: string, style: "medium" | "long" = "medium") {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: style,
    timeStyle: "short",
  }).format(new Date(iso))
}
