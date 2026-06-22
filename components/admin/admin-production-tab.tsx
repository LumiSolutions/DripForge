"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  GripVertical,
  Loader2,
  RefreshCw,
  Factory,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  downloadDataUrl,
  downloadTextFile,
} from "@/lib/admin/download-helpers"
import { getItemDownloadLinks } from "@/lib/admin/item-downloads"
import { getItemPersonalizationLines } from "@/lib/admin/order-personalization"
import {
  isOrderVisibleInProductionCockpit,
  nextProductionStatus,
  prevProductionStatus,
  PRODUCTION_COLUMNS,
  requiresShipmentModal,
  resolveProductionStatus,
} from "@/lib/admin/production-status"
import { handlePrintPostLabel } from "@/lib/admin/post-label"
import {
  CUSTOMER_INBOUND_PRODUCTION_LABEL,
  isCustomerInboundOrder,
} from "@/lib/admin/customer-inbound-order"
import { formatChf } from "@/lib/admin/format-chf"
import type { ProductionStatus, StoredOrder } from "@/lib/admin/types"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso))
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

function ProductionOrderCard({
  order,
  columnStatus,
  onMove,
  onRequestShipment,
  updating,
}: {
  order: StoredOrder
  columnStatus: ProductionStatus
  onMove: (orderId: string, status: ProductionStatus) => void
  onRequestShipment: (order: StoredOrder) => void
  updating: boolean
}) {
  const prev = prevProductionStatus(columnStatus)
  const next = nextProductionStatus(columnStatus)
  const customerInbound = isCustomerInboundOrder(order)
  const previewSrc =
    order.items.find((i) => i.leitbildUrl ?? i.leitbild)?.leitbildUrl ??
    order.items.find((i) => i.leitbild)?.leitbild

  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/order-id", order.orderId)
        e.dataTransfer.effectAllowed = "move"
      }}
      className={cn(
        "cursor-grab active:cursor-grabbing",
        customerInbound
          ? "border-l-4 border-l-amber-500 bg-amber-500/5 ring-1 ring-amber-500/25"
          : "border-l-4 border-l-orange-500",
        adminUi.card,
        updating && "opacity-60"
      )}
    >
      <CardHeader className="space-y-2 p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("font-mono text-xs", adminUi.accentTitle)}>
              {order.orderId}
            </p>
            <p className={cn("truncate text-sm font-semibold", adminUi.heading)}>
              {order.billing.firstName} {order.billing.lastName}
            </p>
            <p className={cn("text-xs", adminUi.muted)}>{formatDate(order.createdAt)}</p>
          </div>
          <GripVertical className={cn("h-4 w-4 shrink-0", adminUi.muted)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {customerInbound && (
            <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200">
              {CUSTOMER_INBOUND_PRODUCTION_LABEL}
            </Badge>
          )}
          <Badge variant="outline" className={adminUi.badgeOutline}>
            {formatChf(order.totals.total)}
          </Badge>
          <Badge variant="outline" className={adminUi.badgeOutline}>
            {order.items.length} Pos.
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {previewSrc && (
          <div className={cn("overflow-hidden rounded-lg border", adminUi.thumbnail)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="Vorschau"
              className="max-h-28 w-full object-contain bg-black/30"
            />
          </div>
        )}

        {order.items.map((item) => {
          const lines = getItemPersonalizationLines(item)
          const downloads = getItemDownloadLinks(order.orderId, item)
          return (
            <div
              key={item.id}
              className={cn("space-y-2 rounded-lg border p-3 text-sm", adminUi.section)}
            >
              <p className={cn("font-medium", adminUi.heading)}>
                {item.name}{" "}
                <span className={cn("font-normal", adminUi.muted)}>×{item.quantity}</span>
              </p>
              {lines.length > 0 ? (
                <ul className={cn("space-y-0.5 text-xs", adminUi.bodyText)}>
                  {lines.map((line) => (
                    <li key={`${line.label}-${line.value}`}>
                      <span className={adminUi.muted}>{line.label}:</span> {line.value}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={cn("text-xs", adminUi.muted)}>Keine Zusatzdetails</p>
              )}
              {downloads.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {downloads.map((file) => (
                    <Button
                      key={file.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn("h-7 text-xs", adminUi.outlineBtn)}
                      onClick={() =>
                        triggerFileDownload(file.filename, file.href)
                      }
                    >
                      <Download className="mr-1 h-3 w-3" />
                      {file.label}
                    </Button>
                  ))}
                </div>
              )}
              {item.customDetails?.fileName && downloads.length === 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn("h-7 text-xs", adminUi.outlineBtn)}
                  onClick={() =>
                    downloadTextFile(
                      item.customDetails!.fileName!,
                      `3D-Modell: ${item.customDetails!.fileName}\n(Bitte Originaldatei aus Kundenkommunikation.)`
                    )
                  }
                >
                  <Download className="mr-1 h-3 w-3" />
                  {item.customDetails.fileName}
                </Button>
              )}
            </div>
          )
        })}

        {order.trackingNumber && columnStatus === "versendet" && (
          <p className={cn("font-mono text-xs", adminUi.muted)}>
            Tracking: {order.trackingNumber}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          {prev && columnStatus !== "versendet" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={updating}
              className={adminUi.outlineBtn}
              onClick={() => onMove(order.orderId, prev)}
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Zurück
            </Button>
          )}
          {next && (
            <Button
              type="button"
              size="sm"
              disabled={updating}
              className={cn("flex-1", adminUi.primaryBtn)}
              onClick={() => {
                if (
                  requiresShipmentModal(columnStatus, next)
                ) {
                  onRequestShipment(order)
                } else {
                  onMove(order.orderId, next)
                }
              }}
            >
              {next === "versendet" ? "Versenden" : "Weiter"}
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminProductionTab() {
  const [orders, setOrders] = useState<StoredOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [shipModalOrder, setShipModalOrder] = useState<StoredOrder | null>(null)
  const [trackingNumber, setTrackingNumber] = useState("")
  const [shipBusy, setShipBusy] = useState(false)
  const [shipNotice, setShipNotice] = useState<string | null>(null)

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

  const productionOrders = useMemo(
    () => orders.filter(isOrderVisibleInProductionCockpit),
    [orders]
  )

  const byColumn = useMemo(() => {
    const map = new Map<ProductionStatus, StoredOrder[]>()
    for (const col of PRODUCTION_COLUMNS) {
      map.set(col.id, [])
    }
    for (const order of productionOrders) {
      const status = resolveProductionStatus(order)
      map.get(status)?.push(order)
    }
    return map
  }, [productionOrders])

  const moveOrder = async (orderId: string, productionStatus: ProductionStatus) => {
    if (productionStatus === "versendet") return
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

  const openShipmentModal = (order: StoredOrder) => {
    setShipModalOrder(order)
    setTrackingNumber(order.trackingNumber ?? "")
    setShipNotice(null)
  }

  const completeShipment = async () => {
    if (!shipModalOrder) return
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
          trackingNumber,
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
          ? "Versand abgeschlossen — Kunde wurde per E-Mail benachrichtigt."
          : "Versand abgeschlossen — Versandbestätigung vorbereitet (SMTP prüfen)."
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
    const order = productionOrders.find((o) => o.orderId === orderId)
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

  if (loading && orders.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-24", adminUi.loader)}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Produktions-Cockpit wird geladen…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={cn("flex items-center gap-2 text-xl font-bold", adminUi.heading)}>
            <Factory className="h-5 w-5 text-orange-500" />
            Produktions-Cockpit
          </h2>
          <p className={cn("text-sm", adminUi.muted)}>
            {productionOrders.length} aktive Aufträge · Drag & Drop oder «Weiter»/«Zurück»
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

      {shipNotice && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {shipNotice}
        </p>
      )}

      {error && <p className={adminUi.errorLg}>{error}</p>}

      <div className="grid gap-4 xl:grid-cols-5">
        {PRODUCTION_COLUMNS.map((column) => {
          const columnOrders = byColumn.get(column.id) ?? []
          return (
            <div
              key={column.id}
              className={cn(
                "flex min-h-[420px] flex-col rounded-xl border",
                adminUi.sidebarBorder,
                adminUi.cardMuted
              )}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
              }}
              onDrop={(e) => {
                e.preventDefault()
                const orderId = e.dataTransfer.getData("text/order-id")
                if (orderId) handleDrop(column.id, orderId)
              }}
            >
              <div className={cn("border-b p-4", adminUi.sidebarBorder)}>
                <CardTitle className={cn("text-sm font-bold", adminUi.heading)}>
                  {column.label}
                </CardTitle>
                <p className={cn("mt-0.5 text-xs", adminUi.muted)}>{column.hint}</p>
                <Badge className="mt-2" variant="outline">
                  {columnOrders.length}
                </Badge>
              </div>
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
                {columnOrders.length === 0 ? (
                  <p
                    className={cn(
                      "rounded-lg border border-dashed py-8 text-center text-xs",
                      adminUi.empty
                    )}
                  >
                    Keine Aufträge
                  </p>
                ) : (
                  columnOrders.map((order) => (
                    <ProductionOrderCard
                      key={order.orderId}
                      order={order}
                      columnStatus={column.id}
                      onMove={moveOrder}
                      onRequestShipment={openShipmentModal}
                      updating={updatingId === order.orderId}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

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
            <DialogTitle>Versand abschliessen</DialogTitle>
          </DialogHeader>
          {shipModalOrder && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Bestellung{" "}
                <span className="font-mono font-medium text-foreground">
                  {shipModalOrder.orderId}
                </span>{" "}
                — {shipModalOrder.billing.firstName} {shipModalOrder.billing.lastName}
              </p>
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
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
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
            <Button
              type="button"
              disabled={!shipModalOrder || shipBusy || !trackingNumber.trim()}
              className={adminUi.primaryBtn}
              onClick={() => void completeShipment()}
            >
              {shipBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gespeichert…
                </>
              ) : (
                "Versand abschliessen"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
