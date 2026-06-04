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
  resolveProductionStatus,
} from "@/lib/admin/production-status"
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
  updating,
}: {
  order: StoredOrder
  columnStatus: ProductionStatus
  onMove: (orderId: string, status: ProductionStatus) => void
  updating: boolean
}) {
  const prev = prevProductionStatus(columnStatus)
  const next = nextProductionStatus(columnStatus)
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
        "cursor-grab border-l-4 border-l-orange-500 active:cursor-grabbing",
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

        <div className="flex gap-2 pt-1">
          {prev && (
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
              onClick={() => onMove(order.orderId, next)}
            >
              Weiter
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
    setUpdatingId(orderId)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionStatus }),
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

  const handleDrop = (status: ProductionStatus, orderId: string) => {
    const order = productionOrders.find((o) => o.orderId === orderId)
    if (!order) return
    if (resolveProductionStatus(order) === status) return
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

      {error && <p className={adminUi.errorLg}>{error}</p>}

      <div className="grid gap-4 xl:grid-cols-4">
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
                      updating={updatingId === order.orderId}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
