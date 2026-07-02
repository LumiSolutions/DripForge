"use client"

import Link from "next/link"
import { Download, ExternalLink, FileDown, LifeBuoy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CustomerOrderSummary } from "@/lib/konto/customer-orders"
import { CUSTOMER_ORDER_TIMELINE_STEPS } from "@/lib/konto/customer-order-timeline"
import { cn } from "@/lib/utils"

export function OrderStatusTimeline({ order }: { order: CustomerOrderSummary }) {
  const activeIndex = order.timelineStepIndex

  return (
    <div className="space-y-3 border-t border-border/50 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Bestellstatus
      </p>
      <ol className="relative flex flex-col gap-0 sm:flex-row sm:items-start sm:justify-between">
        {CUSTOMER_ORDER_TIMELINE_STEPS.map((step, index) => {
          const done = index < activeIndex
          const active = index === activeIndex
          const pending = index > activeIndex

          return (
            <li
              key={step.id}
              className="relative flex flex-1 flex-col items-start pb-4 sm:items-center sm:pb-0 sm:text-center"
            >
              {index < CUSTOMER_ORDER_TIMELINE_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-3 top-3 hidden h-0.5 sm:block sm:h-auto sm:w-full sm:border-t-2 sm:border-l-0",
                    index < activeIndex ? "border-primary" : "border-border/60"
                  )}
                  style={{ left: "50%", width: "100%" }}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-primary/15 text-primary ring-2 ring-primary/25",
                  pending && "border-border bg-muted text-muted-foreground"
                )}
              >
                {done ? "✓" : index + 1}
              </span>
              <span
                className={cn(
                  "mt-2 max-w-[9rem] text-xs leading-snug",
                  active ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
      {order.status === "versendet" && order.trackingUrl && order.trackingNumber && (
        <p className="text-sm">
          Sendungsnummer:{" "}
          <a
            href={order.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            {order.trackingNumber}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </p>
      )}
    </div>
  )
}

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
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium leading-snug">{item.name}</p>
              <Badge variant="secondary" className="text-[10px] uppercase">
                {item.type === "3d" ? "3D-Druck" : "Laser"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {item.quantity}× CHF {item.unitPriceChf.toFixed(2)}
            </p>
            {item.engravingText ? (
              <p className="mt-1 text-xs">
                <span className="font-medium text-foreground">Gravur:</span>{" "}
                <span className="text-muted-foreground">{item.engravingText}</span>
              </p>
            ) : null}
            {item.fileName ? (
              <p className="mt-1 text-xs">
                <span className="font-medium text-foreground">3D-Datei:</span>{" "}
                <span className="font-mono text-muted-foreground">{item.fileName}</span>
              </p>
            ) : null}
            {item.options.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {item.options.map((option) => (
                  <li key={option}>{option}</li>
                ))}
              </ul>
            )}
            {item.downloads.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {item.downloads.map((download) => (
                  <a
                    key={download.id}
                    href={download.href}
                    className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/5"
                  >
                    <FileDown className="h-3 w-3" />
                    {download.label}
                  </a>
                ))}
              </div>
            ) : null}
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
      {order.canDownloadInvoice ? (
        <Button type="button" size="sm" variant="outline" onClick={() => void handleInvoiceDownload()}>
          <Download className="mr-2 h-4 w-4" />
          Rechnung herunterladen (PDF)
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Rechnung verfuegbar, sobald die Zahlung bestaetigt ist.
        </p>
      )}
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
