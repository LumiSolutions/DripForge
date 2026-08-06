"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Factory,
  GripVertical,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  downloadDataUrl,
  downloadTextFile,
} from "@/lib/admin/download-helpers"
import {
  getItemDownloadLinks,
  getItemMockupSrc,
} from "@/lib/admin/item-downloads"
import {
  getItemLogoPreviewSrc,
  getItemModelFile,
  getLaserPlacementLines,
  orderMatchesJobType,
} from "@/lib/admin/layout-placement"
import { getItemPersonalizationLines } from "@/lib/admin/order-personalization"
import {
  isOrderPaid,
  isOrderVisibleInProductionCockpit,
  needsManualPaymentConfirmation,
  needsPaymentSettlementDialog,
  nextProductionStatus,
  prevProductionStatus,
  PRODUCTION_COLUMNS,
  productionStatusLabel,
  requiresShipmentModal,
  resolveProductionStatus,
} from "@/lib/admin/production-status"
import {
  resolveOrderFulfillmentLabel,
  shouldCollectPostTracking,
} from "@/lib/admin/order-fulfillment"
import { handlePrintPostLabel } from "@/lib/admin/post-label"
import {
  CUSTOMER_INBOUND_PRODUCTION_LABEL,
  isCustomerInboundOrder,
} from "@/lib/admin/customer-inbound-order"
import { formatChf } from "@/lib/admin/format-chf"
import type { ProductionStatus, StoredOrder, StoredOrderItem } from "@/lib/admin/types"
import { AdminPaymentReceiptDialog } from "@/components/admin/admin-payment-receipt-dialog"
import type { PaymentSettlementAccount } from "@/lib/accounting/order-journal"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type SortKey = "newest" | "oldest" | "value" | "customer"
type JobTypeFilter = "all" | "3d" | "laser"

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso))
}

function customerName(order: StoredOrder) {
  return `${order.billing.firstName} ${order.billing.lastName}`.trim()
}

function paymentLabel(order: StoredOrder) {
  if (order.paymentConfirmed === true || order.paymentStatus === "paid") {
    return "Bezahlt"
  }
  if (order.paymentConfirmed === false || order.paymentStatus === "pending") {
    return "Ausstehend"
  }
  return order.paymentMethodLabel
}

function triggerFileDownload(filename: string, href: string) {
  if (href.startsWith("data:")) {
    downloadDataUrl(filename, href)
    return
  }
  const link = document.createElement("a")
  link.href = href
  link.download = filename
  link.rel = "noopener"
  if (href.startsWith("/api/")) {
    link.target = "_blank"
  }
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function sortOrders(orders: StoredOrder[], sort: SortKey): StoredOrder[] {
  const next = [...orders]
  next.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case "value":
        return b.totals.total - a.totals.total
      case "customer":
        return customerName(a).localeCompare(customerName(b), "de-CH")
      case "newest":
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
  })
  return next
}

function ItemAttachmentBlock({
  orderId,
  item,
}: {
  orderId: string
  item: StoredOrderItem
}) {
  const lines = getItemPersonalizationLines(item)
  const downloads = getItemDownloadLinks(orderId, item)
  const model = getItemModelFile(item)
  const logoSrc = getItemLogoPreviewSrc(item)
  const mockupSrc = getItemMockupSrc(item)
  const placements = getLaserPlacementLines(item)
  const stlDownload = downloads.find((d) => d.role === "stl")
  const leitbildDownload = downloads.find((d) => d.role === "leitbild")
  const mockupDownload = downloads.find((d) => d.role === "mockup")
  const assetDownloads = downloads.filter(
    (d) => d.role === "logo" || d.role === "text" || d.role === "skizze"
  )

  return (
    <div
      className={cn(
        "w-full max-w-full space-y-2 overflow-hidden rounded-lg border p-3 text-sm",
        adminUi.section
      )}
    >
      <div className="flex w-full max-w-full flex-wrap items-center gap-2">
        <p
          className={cn(
            "min-w-0 flex-1 break-words font-medium",
            adminUi.heading
          )}
        >
          {item.name}{" "}
          <span className={cn("font-normal", adminUi.muted)}>×{item.quantity}</span>
        </p>
        <Badge
          variant="outline"
          className={cn("shrink-0 text-[10px]", adminUi.badgeOutline)}
        >
          {item.type === "3d" ? "3D-Druck" : "Laser"}
        </Badge>
      </div>

      {lines.length > 0 ? (
        <ul className={cn("w-full max-w-full space-y-0.5 break-words text-xs", adminUi.bodyText)}>
          {lines.map((line) => (
            <li key={`${line.label}-${line.value}`} className="break-words">
              <span className={adminUi.muted}>{line.label}:</span> {line.value}
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn("text-xs", adminUi.muted)}>Keine Zusatzdetails</p>
      )}

      {item.type === "laser" && (mockupSrc || logoSrc || placements.length > 0) && (
        <div className="flex w-full max-w-full flex-wrap items-start gap-3 pt-1">
          {mockupSrc && (
            <div className={cn("overflow-hidden rounded-md border", adminUi.thumbnail)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mockupSrc}
                alt="Vorschau-Mockup"
                className="h-20 w-28 object-contain bg-black/20"
              />
            </div>
          )}
          {!mockupSrc && logoSrc && (
            <div className={cn("overflow-hidden rounded-md border", adminUi.thumbnail)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt="Logo-Vorschau"
                className="h-16 w-16 object-contain bg-black/20"
              />
            </div>
          )}
          <div className={cn("min-w-0 flex-1 space-y-1 break-words text-xs", adminUi.bodyText)}>
            {placements.map((p) => (
              <p key={`${p.label}-${p.value}`} className="break-words">
                <span className="font-medium">Position:</span>{" "}
                <span className={adminUi.muted}>{p.label} — </span>
                {p.value}
              </p>
            ))}
            {mockupSrc && (
              <p className={adminUi.muted}>Kombiniertes Vorschau-Mockup</p>
            )}
          </div>
        </div>
      )}

      {item.type === "3d" && mockupSrc && (
        <div className={cn("overflow-hidden rounded-md border", adminUi.thumbnail)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mockupSrc}
            alt="Leitbild"
            className="max-h-24 w-full object-contain bg-black/20"
          />
        </div>
      )}

      <div className="flex w-full max-w-full flex-wrap gap-1.5 pt-1">
        {item.type === "3d" && stlDownload && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn("h-7 max-w-full text-xs", adminUi.outlineBtn)}
            onClick={() =>
              triggerFileDownload(stlDownload.filename, stlDownload.href)
            }
          >
            <Download className="mr-1 h-3 w-3 shrink-0" />
            <span className="truncate">STL-Datei herunterladen</span>
          </Button>
        )}
        {item.type === "3d" && !stlDownload && model && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn("h-7 max-w-full text-xs", adminUi.outlineBtn)}
            onClick={() =>
              downloadTextFile(
                model.fileName,
                `3D-Modell: ${model.fileName}\n(Bitte Originaldatei aus Kundenkommunikation.)`
              )
            }
          >
            <Download className="mr-1 h-3 w-3 shrink-0" />
            <span className="truncate">STL-Datei herunterladen</span>
          </Button>
        )}
        {item.type === "3d" && leitbildDownload && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn("h-7 max-w-full text-xs", adminUi.outlineBtn)}
            onClick={() =>
              triggerFileDownload(leitbildDownload.filename, leitbildDownload.href)
            }
          >
            <Download className="mr-1 h-3 w-3 shrink-0" />
            Leitbild anzeigen
          </Button>
        )}
        {item.type === "laser" && mockupDownload && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn("h-7 max-w-full text-xs", adminUi.outlineBtn)}
            onClick={() =>
              triggerFileDownload(mockupDownload.filename, mockupDownload.href)
            }
          >
            <Download className="mr-1 h-3 w-3 shrink-0" />
            <span className="truncate">Vorschau-Mockup</span>
          </Button>
        )}
        {assetDownloads.map((file) => (
          <Button
            key={file.id}
            type="button"
            size="sm"
            variant="outline"
            className={cn("h-7 max-w-full text-xs", adminUi.outlineBtn)}
            onClick={() => triggerFileDownload(file.filename, file.href)}
          >
            <Download className="mr-1 h-3 w-3 shrink-0" />
            <span className="truncate">{file.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

function ProductionOrderDetailDialog({
  order,
  open,
  onOpenChange,
  onConfirmPayment,
  confirming,
}: {
  order: StoredOrder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmPayment: (orderId: string) => void
  confirming: boolean
}) {
  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono">{order.orderId}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 text-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <h4 className={cn("font-semibold", adminUi.accentTitle)}>Kunde</h4>
              <p className={adminUi.heading}>{customerName(order)}</p>
              <p className={adminUi.muted}>{order.billing.email}</p>
              <p className={adminUi.muted}>{order.billing.phone || "—"}</p>
              {order.kundennummer && (
                <p className={cn("font-mono text-xs", adminUi.accentTitle)}>
                  {order.kundennummer}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <h4 className={cn("font-semibold", adminUi.accentTitle)}>Zahlung & Status</h4>
              <p>{order.paymentMethodLabel}</p>
              <p className={adminUi.muted}>Zahlungsstatus: {paymentLabel(order)}</p>
              <p className={adminUi.muted}>
                Produktion: {productionStatusLabel(resolveProductionStatus(order))}
              </p>
              <p className={cn("font-semibold tabular-nums", adminUi.heading)}>
                {formatChf(order.totals.total)}
              </p>
              {needsManualPaymentConfirmation(order) && (
                <Button
                  type="button"
                  size="sm"
                  disabled={confirming}
                  className="mt-1 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => onConfirmPayment(order.orderId)}
                >
                  Zahlungseingang bestätigen
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <h4 className={cn("font-semibold", adminUi.accentTitle)}>Rechnungsadresse</h4>
              <p>
                {order.billing.firstName} {order.billing.lastName}
              </p>
              <p>{order.billing.street}</p>
              <p>
                {order.billing.zip} {order.billing.city}
              </p>
              <p>{order.billing.country}</p>
            </div>
            <div className="space-y-1">
              <h4 className={cn("font-semibold", adminUi.accentTitle)}>Lieferadresse</h4>
              {order.delivery ? (
                <>
                  <p>
                    {order.delivery.firstName} {order.delivery.lastName}
                  </p>
                  <p>{order.delivery.street}</p>
                  <p>
                    {order.delivery.zip} {order.delivery.city}
                  </p>
                  <p>{order.delivery.country}</p>
                </>
              ) : (
                <p className={adminUi.muted}>Entspricht der Rechnungsadresse</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className={cn("font-semibold", adminUi.accentTitle)}>
              Positionen ({order.items.length})
            </h4>
            {order.items.map((item) => (
              <ItemAttachmentBlock
                key={item.id}
                orderId={order.orderId}
                item={item}
              />
            ))}
          </div>

          {order.trackingNumber && (
            <p className={cn("font-mono text-xs", adminUi.muted)}>
              Tracking: {order.trackingNumber}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ProductionOrderCard({
  order,
  columnStatus,
  onMove,
  onConfirmPayment,
  onRequestShipment,
  onShowDetails,
  updating,
  isDragging,
  onDragBegin,
  onDragEnd,
}: {
  order: StoredOrder
  columnStatus: ProductionStatus
  onMove: (orderId: string, status: ProductionStatus) => void
  onConfirmPayment: (orderId: string) => void
  onRequestShipment: (order: StoredOrder) => void
  onShowDetails: (order: StoredOrder) => void
  updating: boolean
  isDragging: boolean
  onDragBegin: (orderId: string) => void
  onDragEnd: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const prev = prevProductionStatus(columnStatus)
  const next = nextProductionStatus(columnStatus)
  const customerInbound = isCustomerInboundOrder(order)
  const paid = isOrderPaid(order)
  const awaitingPayment = needsManualPaymentConfirmation(order)

  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/order-id", order.orderId)
        e.dataTransfer.effectAllowed = "move"
        onDragBegin(order.orderId)
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "w-full max-w-full cursor-grab overflow-hidden active:cursor-grabbing",
        customerInbound
          ? "border-l-4 border-l-amber-500 bg-amber-500/5 ring-1 ring-amber-500/25"
          : "border-l-4 border-l-orange-500",
        adminUi.card,
        updating && "opacity-60",
        isDragging && "scale-[1.02] opacity-40 shadow-2xl ring-2 ring-orange-500/40"
      )}
    >
      <CardHeader className="w-full max-w-full space-y-2 overflow-hidden p-3 pb-2">
        <div className="flex w-full max-w-full items-start justify-between gap-2">
          <div className="min-w-0 flex-1 overflow-hidden">
            <p
              className={cn(
                "w-full max-w-full break-all font-mono text-xs",
                adminUi.accentTitle
              )}
            >
              {order.orderId}
            </p>
            <p className={cn("text-[11px]", adminUi.muted)}>
              {formatDate(order.createdAt)}
            </p>
            <p
              className={cn(
                "mt-0.5 w-full max-w-full overflow-hidden text-ellipsis break-words text-sm font-semibold",
                adminUi.heading
              )}
            >
              {customerName(order)}
            </p>
            <p
              className={cn(
                "w-full max-w-full overflow-hidden text-ellipsis break-all text-xs",
                adminUi.muted
              )}
            >
              {order.billing.email}
              {order.billing.phone ? ` · ${order.billing.phone}` : ""}
            </p>
          </div>
          <GripVertical className={cn("mt-0.5 h-4 w-4 shrink-0", adminUi.muted)} />
        </div>
        {(() => {
          const thumbs = order.items
            .map((item) => ({
              id: item.id,
              src: getItemMockupSrc(item),
              type: item.type,
            }))
            .filter((t): t is { id: string; src: string; type: StoredOrderItem["type"] } =>
              Boolean(t.src)
            )
            .slice(0, 3)
          if (thumbs.length === 0) return null
          return (
            <div className="flex w-full max-w-full gap-1.5 overflow-hidden">
              {thumbs.map((thumb) => (
                <div
                  key={thumb.id}
                  className={cn(
                    "h-12 w-16 shrink overflow-hidden rounded border bg-black/20",
                    adminUi.thumbnail
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumb.src}
                    alt={thumb.type === "laser" ? "Mockup" : "Leitbild"}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )
        })()}
        <div className="flex w-full max-w-full flex-wrap items-center gap-1.5 overflow-hidden">
          {customerInbound && (
            <Badge className="max-w-full break-words border-amber-500/40 bg-amber-500/15 text-[10px] text-amber-800 dark:text-amber-200">
              {CUSTOMER_INBOUND_PRODUCTION_LABEL}
            </Badge>
          )}
          <Badge variant="outline" className={cn("text-[10px]", adminUi.badgeOutline)}>
            {formatChf(order.totals.total)}
          </Badge>
          <Badge variant="outline" className={cn("text-[10px]", adminUi.badgeOutline)}>
            {order.items.length} Pos.
          </Badge>
          <Badge
            className={cn(
              "text-[10px]",
              paid
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200"
            )}
          >
            {paid ? "Bezahlt" : "Zahlung offen"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 p-3 pt-0">
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-full justify-between px-2 text-xs",
                adminUi.muted
              )}
            >
              {expanded ? "Details einklappen" : "Details ausklappen"}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  expanded && "rotate-180"
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="space-y-2 pb-1 pt-2">
              {order.items.map((item) => (
                <ItemAttachmentBlock
                  key={item.id}
                  orderId={order.orderId}
                  item={item}
                />
              ))}
              {order.trackingNumber && columnStatus === "versendet" && (
                <p className={cn("font-mono text-xs", adminUi.muted)}>
                  Tracking: {order.trackingNumber}
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="w-full space-y-2 border-t border-slate-200/80 pt-2 dark:border-zinc-800">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn("h-8 w-full text-xs", adminUi.outlineBtn)}
            onClick={() => onShowDetails(order)}
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Bestellung anzeigen
          </Button>
          {awaitingPayment && (
            <Button
              type="button"
              size="sm"
              disabled={updating}
              className="h-8 w-full bg-emerald-600 text-xs text-white hover:bg-emerald-700"
              onClick={() => onConfirmPayment(order.orderId)}
            >
              Zahlungseingang bestätigen
            </Button>
          )}
          <div className="flex w-full gap-2">
            {prev && columnStatus !== "versendet" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={updating}
                className={cn("h-8 min-w-0 flex-1 px-2 text-xs", adminUi.outlineBtn)}
                onClick={() => onMove(order.orderId, prev)}
              >
                <ChevronLeft className="mr-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Zurück</span>
              </Button>
            )}
            {next && !awaitingPayment && (
              <Button
                type="button"
                size="sm"
                disabled={updating}
                className={cn(
                  "h-8 min-w-0 flex-1 px-2 text-xs",
                  adminUi.primaryBtn
                )}
                onClick={() => {
                  if (requiresShipmentModal(columnStatus, next)) {
                    onRequestShipment(order)
                  } else {
                    onMove(order.orderId, next)
                  }
                }}
              >
                <span className="truncate">
                  {next === "versendet" ? "Versenden" : "Weiter"}
                </span>
                <ChevronRight className="ml-0.5 h-3.5 w-3.5 shrink-0" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function shortColumnLabel(label: string) {
  if (label.startsWith("Bereit für Produktion")) return "Bereit"
  if (label === "In Produktion") return "Produktion"
  if (label === "Qualitätskontrolle") return "QS"
  if (label === "Bereit für Versand") return "Versand"
  if (label === "Versendet") return "Versendet"
  return label
}

export function AdminProductionTab() {
  const [orders, setOrders] = useState<StoredOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [shipModalOrder, setShipModalOrder] = useState<StoredOrder | null>(null)
  const [paymentModalOrder, setPaymentModalOrder] = useState<StoredOrder | null>(
    null
  )
  const [trackingNumber, setTrackingNumber] = useState("")
  const [shipBusy, setShipBusy] = useState(false)
  const [shipNotice, setShipNotice] = useState<string | null>(null)
  const [detailOrder, setDetailOrder] = useState<StoredOrder | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("oldest")
  const [jobType, setJobType] = useState<JobTypeFilter>("all")
  const [search, setSearch] = useState("")
  const [mobileColumn, setMobileColumn] = useState<ProductionStatus>(
    "bereit_fuer_produktion"
  )
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<ProductionStatus | null>(
    null
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" })
      const data = (await res.json()) as { orders?: StoredOrder[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setOrders(data.orders ?? [])
    } catch (err) {
      console.warn("Admin: Produktions-Cockpit konnte nicht geladen werden.", err)
      setError(
        err instanceof Error ? err.message : "Aufträge konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = orders.filter(isOrderVisibleInProductionCockpit).filter((order) => {
      if (!orderMatchesJobType(order.items, jobType)) return false
      if (!q) return true
      const haystack = [
        order.orderId,
        customerName(order),
        order.billing.email,
        order.kundennummer ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
    return sortOrders(base, sortKey)
  }, [orders, jobType, search, sortKey])

  const byColumn = useMemo(() => {
    const map = new Map<ProductionStatus, StoredOrder[]>()
    for (const col of PRODUCTION_COLUMNS) {
      map.set(col.id, [])
    }
    for (const order of filteredOrders) {
      const status = resolveProductionStatus(order)
      map.get(status)?.push(order)
    }
    return map
  }, [filteredOrders])

  const shipModalUsesPostTracking = shipModalOrder
    ? shouldCollectPostTracking(shipModalOrder)
    : true
  const shipModalFulfillmentLabel = shipModalOrder
    ? resolveOrderFulfillmentLabel(shipModalOrder)
    : ""

  const moveOrder = async (orderId: string, productionStatus: ProductionStatus) => {
    if (productionStatus === "versendet") return
    // Zahlung muss vor "Bezahlt" bestätigt sein (Rechnung/TWINT).
    if (productionStatus === "bezahlt") {
      const target = orders.find((o) => o.orderId === orderId)
      if (target && !isOrderPaid(target)) {
        void requestConfirmPayment(orderId)
        return
      }
    }
    setUpdatingId(orderId)
    try {
      const res = await fetch("/api/admin/orders/update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, productionStatus }),
      })
      const data = (await res.json()) as { order?: StoredOrder; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Update fehlgeschlagen")
      if (data.order) {
        setOrders((prev) =>
          prev.map((o) => (o.orderId === orderId ? data.order! : o))
        )
      }
    } catch (err) {
      console.warn("Admin: Produktionsstatus-Update fehlgeschlagen.", err)
      setError(
        err instanceof Error ? err.message : "Status konnte nicht gespeichert werden."
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const confirmPayment = async (
    orderId: string,
    options?: {
      settlementAccount?: PaymentSettlementAccount
      paymentDate?: string
    }
  ) => {
    setUpdatingId(orderId)
    try {
      const res = await fetch("/api/admin/orders/update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          confirmPayment: true,
          ...(options?.settlementAccount
            ? { settlementAccount: options.settlementAccount }
            : {}),
          ...(options?.paymentDate ? { paymentDate: options.paymentDate } : {}),
        }),
      })
      const data = (await res.json()) as { order?: StoredOrder; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Zahlungsbestätigung fehlgeschlagen")
      if (data.order) {
        setOrders((prev) =>
          prev.map((o) => (o.orderId === orderId ? data.order! : o))
        )
      }
      setPaymentModalOrder(null)
    } catch (err) {
      console.warn("Admin: Zahlungsbestätigung fehlgeschlagen.", err)
      setError(
        err instanceof Error ? err.message : "Zahlung konnte nicht bestätigt werden."
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const requestConfirmPayment = (orderId: string) => {
    const target = orders.find((o) => o.orderId === orderId)
    if (!target) return
    if (needsPaymentSettlementDialog(target)) {
      setPaymentModalOrder(target)
      return
    }
    void confirmPayment(orderId)
  }

  const openShipmentModal = (order: StoredOrder) => {
    setShipModalOrder(order)
    setTrackingNumber(order.trackingNumber ?? "")
    setShipNotice(null)
  }

  const completeShipment = async () => {
    if (!shipModalOrder) return
    const usesPostTracking = shouldCollectPostTracking(shipModalOrder)
    setShipBusy(true)
    setError(null)
    setShipNotice(null)
    try {
      const res = await fetch("/api/admin/orders/update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: shipModalOrder.orderId,
          status: "versendet",
          productionStatus: "versendet",
          trackingNumber: usesPostTracking ? trackingNumber : "",
        }),
      })
      const data = (await res.json()) as {
        order?: StoredOrder
        emailSent?: boolean
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Versand konnte nicht abgeschlossen werden.")
      if (data.order) {
        setOrders((prev) =>
          prev.map((o) => (o.orderId === data.order!.orderId ? data.order! : o))
        )
      }
      setShipNotice(
        data.emailSent
          ? usesPostTracking
            ? "Versand abgeschlossen — Kunde wurde per E-Mail benachrichtigt."
            : "Abholung / Übergabe abgeschlossen — Kunde wurde per E-Mail benachrichtigt."
          : usesPostTracking
            ? "Versand abgeschlossen — Versandbestätigung vorbereitet (SMTP prüfen)."
            : "Abholung / Übergabe abgeschlossen — Bestätigung vorbereitet (SMTP prüfen)."
      )
      setShipModalOrder(null)
      setTrackingNumber("")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Versand konnte nicht abgeschlossen werden."
      )
    } finally {
      setShipBusy(false)
    }
  }

  const handleDrop = (status: ProductionStatus, orderId: string) => {
    setDragOverColumn(null)
    setDraggingId(null)
    const order = filteredOrders.find((o) => o.orderId === orderId)
    if (!order) return
    const from = resolveProductionStatus(order)
    if (from === status) return
    if (requiresShipmentModal(from, status)) {
      openShipmentModal(order)
      return
    }
    if (status === "versendet") return
    void moveOrder(orderId, status)
  }

  const renderColumn = (column: (typeof PRODUCTION_COLUMNS)[number]) => {
    const columnOrders = byColumn.get(column.id) ?? []
    const isDropTarget = dragOverColumn === column.id && draggingId != null

    return (
      <div
        key={column.id}
        className={cn(
          "relative flex min-h-[320px] min-w-0 w-full max-w-full flex-col overflow-hidden rounded-xl border transition-colors md:min-h-[420px]",
          adminUi.sidebarBorder,
          adminUi.cardMuted,
          isDropTarget &&
            "border-2 border-dashed border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/20"
        )}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "move"
          if (dragOverColumn !== column.id) setDragOverColumn(column.id)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverColumn((prev) => (prev === column.id ? null : prev))
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          const orderId = e.dataTransfer.getData("text/order-id")
          if (orderId) handleDrop(column.id, orderId)
        }}
      >
        {isDropTarget && (
          <div className="pointer-events-none absolute inset-x-3 top-16 z-10 flex justify-center">
            <span className="rounded-full border border-dashed border-orange-500 bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-700 dark:text-orange-300">
              Hierhin verschieben
            </span>
          </div>
        )}
        <div className={cn("border-b p-3 md:p-4", adminUi.sidebarBorder)}>
          <p className={cn("text-sm font-bold", adminUi.heading)}>{column.label}</p>
          <p className={cn("mt-0.5 text-xs", adminUi.muted)}>{column.hint}</p>
          <Badge className="mt-2" variant="outline">
            {columnOrders.length}
          </Badge>
        </div>
        <div className="flex min-w-0 w-full max-w-full flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-2 md:gap-3 md:p-3">
          {columnOrders.length === 0 ? (
            <p
              className={cn(
                "rounded-lg border border-dashed py-8 text-center text-xs",
                adminUi.empty
              )}
            >
              {isDropTarget ? "Hierhin verschieben" : "Keine Aufträge"}
            </p>
          ) : (
            columnOrders.map((order) => (
              <ProductionOrderCard
                key={order.orderId}
                order={order}
                columnStatus={column.id}
                onMove={moveOrder}
                onConfirmPayment={requestConfirmPayment}
                onRequestShipment={openShipmentModal}
                onShowDetails={setDetailOrder}
                updating={updatingId === order.orderId}
                isDragging={draggingId === order.orderId}
                onDragBegin={setDraggingId}
                onDragEnd={() => {
                  setDraggingId(null)
                  setDragOverColumn(null)
                }}
              />
            ))
          )}
        </div>
      </div>
    )
  }

  if (loading && orders.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-24", adminUi.loader)}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Produktions-Cockpit wird geladen…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "sticky top-0 z-10 -mx-4 space-y-3 border-b px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10",
          "border-slate-200/80 bg-slate-50/95 dark:border-zinc-800/80 dark:bg-zinc-950/95"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={cn("flex items-center gap-2 text-xl font-bold", adminUi.heading)}>
              <Factory className="h-5 w-5 text-orange-500" />
              Produktionscockpit
            </h2>
            <p className={cn("text-sm", adminUi.muted)}>
              {filteredOrders.length} Aufträge · Drag & Drop oder «Weiter»/«Zurück»
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
            className={adminUi.outlineBtn}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Aktualisieren
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className={cn("text-xs", adminUi.labelMuted)}>Sortierung</Label>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className={adminUi.select}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Bestelleingang · Neueste zuerst</SelectItem>
                <SelectItem value="oldest">Bestelleingang · Älteste zuerst</SelectItem>
                <SelectItem value="value">Bestellwert</SelectItem>
                <SelectItem value="customer">Kundenname</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className={cn("text-xs", adminUi.labelMuted)}>Auftragstyp</Label>
            <Select
              value={jobType}
              onValueChange={(v) => setJobType(v as JobTypeFilter)}
            >
              <SelectTrigger className={adminUi.select}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="3d">3D-Druck</SelectItem>
                <SelectItem value="laser">Laser-Gravur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className={cn("text-xs", adminUi.labelMuted)}>Suche</Label>
            <div className="relative">
              <Search className={cn("absolute left-2.5 top-2.5 h-4 w-4", adminUi.muted)} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Bestellnummer oder Kundenname…"
                className={cn("pl-9", adminUi.input)}
              />
            </div>
          </div>
        </div>
      </div>

      {shipNotice && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {shipNotice}
        </p>
      )}

      {error && <p className={adminUi.errorLg}>{error}</p>}

      {/* Mobile: Spalten-Tabs / Dropdown */}
      <div className="space-y-3 md:hidden">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {PRODUCTION_COLUMNS.map((column) => {
            const count = byColumn.get(column.id)?.length ?? 0
            const active = mobileColumn === column.id
            return (
              <button
                key={column.id}
                type="button"
                onClick={() => setMobileColumn(column.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-orange-500/50 bg-orange-500/15 text-orange-700 dark:text-orange-300"
                    : cn(adminUi.outlineBtn, "text-slate-600 dark:text-zinc-300")
                )}
              >
                {shortColumnLabel(column.label)}{" "}
                <span className="tabular-nums opacity-80">({count})</span>
              </button>
            )
          })}
        </div>
        <div className="space-y-1">
          <Label className={cn("text-xs md:hidden", adminUi.labelMuted)}>
            Oder Spalte wählen
          </Label>
          <Select
            value={mobileColumn}
            onValueChange={(v) => setMobileColumn(v as ProductionStatus)}
          >
            <SelectTrigger className={cn("md:hidden", adminUi.select)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCTION_COLUMNS.map((column) => (
                <SelectItem key={column.id} value={column.id}>
                  {column.label} ({byColumn.get(column.id)?.length ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {PRODUCTION_COLUMNS.filter((c) => c.id === mobileColumn).map(renderColumn)}
      </div>

      {/* Desktop: 7 Spalten (Pipeline) */}
      <div className="hidden gap-3 md:grid xl:grid-cols-7 lg:grid-cols-4 md:grid-cols-2">
        {PRODUCTION_COLUMNS.map(renderColumn)}
      </div>

      <ProductionOrderDetailDialog
        order={detailOrder}
        open={detailOrder != null}
        onConfirmPayment={requestConfirmPayment}
        confirming={updatingId === detailOrder?.orderId}
        onOpenChange={(open) => {
          if (!open) setDetailOrder(null)
        }}
      />

      <AdminPaymentReceiptDialog
        order={paymentModalOrder}
        open={paymentModalOrder != null}
        busy={updatingId === paymentModalOrder?.orderId}
        onOpenChange={(open) => {
          if (!open && updatingId == null) setPaymentModalOrder(null)
        }}
        onConfirm={({ orderId, settlementAccount, paymentDate }) =>
          confirmPayment(orderId, { settlementAccount, paymentDate })
        }
      />

      <Dialog
        open={shipModalOrder != null}
        onOpenChange={(open) => {
          if (!open && !shipBusy) {
            setShipModalOrder(null)
            setTrackingNumber("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {shipModalUsesPostTracking
                ? "Versand abschliessen"
                : "Übergabe / Abholung abschliessen"}
            </DialogTitle>
          </DialogHeader>
          {shipModalOrder && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Bestellung{" "}
                <span className="font-mono font-medium text-foreground">
                  {shipModalOrder.orderId}
                </span>{" "}
                — {customerName(shipModalOrder)}
              </p>
              <p className={cn("text-xs", adminUi.muted)}>
                Versandart: {shipModalFulfillmentLabel}
              </p>
              {shipModalUsesPostTracking && (
                <div className="space-y-2">
                  <Label htmlFor="trackingNumber">
                    Schweizer Post Tracking-Nummer (Sendungsnummer)
                  </Label>
                  <Input
                    id="trackingNumber"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="z. B. 99.60.123456.12345678"
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            {shipModalUsesPostTracking && (
              <Button
                type="button"
                variant="outline"
                disabled={!shipModalOrder || shipBusy}
                onClick={() => {
                  if (shipModalOrder) void handlePrintPostLabel(shipModalOrder.orderId)
                }}
              >
                Post-Etikette drucken
              </Button>
            )}
            <Button
              type="button"
              disabled={!shipModalOrder || shipBusy}
              className={adminUi.primaryBtn}
              onClick={() => void completeShipment()}
            >
              {shipBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gespeichert…
                </>
              ) : (
                shipModalUsesPostTracking
                  ? "Versand abschliessen"
                  : "Als abgeholt / übergeben markieren"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
