"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  downloadDataUrl,
  downloadTextFile,
  sanitizeFilename,
} from "@/lib/admin/download-helpers"
import {
  ORDER_STATUS_OPTIONS,
  type OrderStatus,
  type StoredOrder,
} from "@/lib/admin/types"
import { LASER_FONT_OPTIONS } from "@/lib/dripforge/laser-fonts"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))
}

function customerName(order: StoredOrder) {
  return `${order.billing.firstName} ${order.billing.lastName}`.trim()
}

function fontLabel(fontId?: string) {
  if (!fontId) return "—"
  return LASER_FONT_OPTIONS.find((f) => f.id === fontId)?.label ?? fontId
}

function OrderDetailPanel({ order }: { order: StoredOrder }) {
  const downloadInvoice = () => {
    window.open(
      `/api/admin/orders/${encodeURIComponent(order.orderId)}/invoice`,
      "_blank"
    )
  }

  return (
    <div className={cn("space-y-6 border-t p-6", adminUi.detailPanel, adminUi.sidebarBorder)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>Bestelldetails</h4>
        <Button
          type="button"
          size="sm"
          onClick={downloadInvoice}
          className={adminUi.primaryBtn}
        >
          <FileText className="mr-2 h-4 w-4" />
          Rechnung herunterladen (PDF)
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>Kunde & Zahlung</h4>
          <dl className={cn("space-y-1 text-sm", adminUi.bodyText)}>
            <div>
              <dt className={adminUi.muted}>Name</dt>
              <dd>{customerName(order)}</dd>
            </div>
            <div>
              <dt className={adminUi.muted}>E-Mail</dt>
              <dd>{order.billing.email}</dd>
            </div>
            {order.kundennummer && (
              <div>
                <dt className={adminUi.muted}>Kundennr.</dt>
                <dd className={cn("font-mono", adminUi.accentTitle)}>{order.kundennummer}</dd>
              </div>
            )}
            <div>
              <dt className={adminUi.muted}>Telefon</dt>
              <dd>{order.billing.phone}</dd>
            </div>
            <div>
              <dt className={adminUi.muted}>Adresse</dt>
              <dd>
                {order.billing.street}, {order.billing.zip} {order.billing.city},{" "}
                {order.billing.country}
              </dd>
            </div>
            <div>
              <dt className={adminUi.muted}>Zahlungsart</dt>
              <dd className={cn("font-medium", adminUi.heading)}>{order.paymentMethodLabel}</dd>
            </div>
          </dl>
        </div>

        {order.delivery && (
          <div className="space-y-3">
            <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>Lieferadresse</h4>
            <dl className={cn("space-y-1 text-sm", adminUi.bodyText)}>
              <dd>
                {order.delivery.firstName} {order.delivery.lastName}
              </dd>
              <dd>
                {order.delivery.street}, {order.delivery.zip} {order.delivery.city}
              </dd>
            </dl>
          </div>
        )}
      </div>

      {order.items.map((item) => (
        <div
          key={item.id}
          className={cn("rounded-xl border p-5", adminUi.orderItemCard)}
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={cn("font-semibold", adminUi.heading)}>{item.name}</p>
              <p className={cn("text-xs", adminUi.muted)}>
                {item.type === "3d" ? "3D-Druck" : "Lasergravur"} · x{item.quantity} · CHF{" "}
                {(item.price * item.quantity).toFixed(2)}
              </p>
            </div>
            <Badge variant="outline" className={adminUi.badgeOutline}>
              {item.id}
            </Badge>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h5 className={cn("text-xs font-semibold uppercase tracking-wide", adminUi.muted)}>
                Werkstatt-Daten
              </h5>
              {item.type === "3d" ? (
                <ul className={cn("space-y-1 text-sm", adminUi.bodyText)}>
                  {item.customDetails?.fileName && (
                    <li>
                      <span className={adminUi.muted}>Datei:</span>{" "}
                      {item.customDetails.fileName}
                    </li>
                  )}
                  {item.customDetails?.filament && (
                    <li>
                      <span className={adminUi.muted}>Material:</span>{" "}
                      {item.customDetails.filament}
                    </li>
                  )}
                  {item.customDetails?.color && (
                    <li>
                      <span className={adminUi.muted}>AMS-Farben:</span>{" "}
                      {item.customDetails.color}
                    </li>
                  )}
                  {item.customDetails?.dimensions && (
                    <li>
                      <span className={adminUi.muted}>Masse:</span>{" "}
                      {item.customDetails.dimensions}
                    </li>
                  )}
                  {item.customDetails?.scale && (
                    <li>
                      <span className={adminUi.muted}>Skalierung:</span>{" "}
                      {item.customDetails.scale}
                    </li>
                  )}
                  {item.customDetails?.colorWishes && (
                    <li>
                      <span className={adminUi.muted}>Farbwuensche:</span>{" "}
                      {item.customDetails.colorWishes}
                    </li>
                  )}
                </ul>
              ) : (
                <ul className={cn("space-y-1 text-sm", adminUi.bodyText)}>
                  {item.customDetails?.material && (
                    <li>
                      <span className={adminUi.muted}>Material:</span>{" "}
                      {item.customDetails.material}
                    </li>
                  )}
                  {(item.customDetails?.variant ||
                    item.customDetails?.materialVariant) && (
                    <li>
                      <span className={adminUi.muted}>Variante:</span>{" "}
                      {item.customDetails.variant ??
                        item.customDetails.materialVariant}
                    </li>
                  )}
                  {(item.customDetails?.userText ||
                    item.customDetails?.engravingText) && (
                    <li>
                      <span className={adminUi.muted}>Gravurtext:</span>{" "}
                      {item.customDetails.userText ??
                        item.customDetails.engravingText}
                    </li>
                  )}
                  {item.customDetails?.userFont && (
                    <li>
                      <span className={adminUi.muted}>Schriftart:</span>{" "}
                      {fontLabel(item.customDetails.userFont)}
                    </li>
                  )}
                  {item.customDetails?.layoutCoordinates?.textPosition && (
                    <li>
                      <span className={adminUi.muted}>Text-Position:</span>{" "}
                      {Math.round(
                        item.customDetails.layoutCoordinates.textPosition.x
                      )}
                      % /{" "}
                      {Math.round(
                        item.customDetails.layoutCoordinates.textPosition.y
                      )}
                      %
                    </li>
                  )}
                </ul>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {item.customDetails?.fileName && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={adminUi.outlineBtn}
                    onClick={() =>
                      downloadTextFile(
                        sanitizeFilename(item.customDetails!.fileName!),
                        `Referenzdatei: ${item.customDetails!.fileName}\n(Bitte Original aus Produktionsablage laden.)`
                      )
                    }
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    {item.customDetails.fileName}
                  </Button>
                )}
                {item.customDetails?.uploadedImage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={adminUi.outlineBtn}
                    onClick={() =>
                      downloadDataUrl(
                        sanitizeFilename(`${item.id}-logo.png`),
                        item.customDetails!.uploadedImage!
                      )
                    }
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Logo herunterladen
                  </Button>
                )}
                {item.customDetails?.colorReferenceImage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={adminUi.outlineBtn}
                    onClick={() =>
                      downloadDataUrl(
                        sanitizeFilename(
                          item.customDetails!.colorReferenceImageName ??
                            `${item.id}-skizze.png`
                        ),
                        item.customDetails!.colorReferenceImage!
                      )
                    }
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Farb-Skizze
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h5 className={cn("text-xs font-semibold uppercase tracking-wide", adminUi.muted)}>
                Qualitaetssicherung — Leitbild
              </h5>
              {item.leitbild || item.leitbildUrl ? (
                <div className={cn("overflow-hidden rounded-xl border bg-black/40", adminUi.thumbnail)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.leitbildUrl ?? item.leitbild}
                    alt="Leitbild Kunden-Wunsch-Ansicht"
                    className="max-h-80 w-full object-contain"
                  />
                  <div className={cn("flex items-center justify-between gap-2 border-t px-3 py-2", adminUi.sidebarBorder)}>
                    <span className={cn("text-xs", adminUi.muted)}>
                      Snapshot beim Warenkorb-Hinzufuegen
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn("hover:text-orange-300", adminUi.accentTitle)}
                      onClick={() =>
                        downloadDataUrl(
                          sanitizeFilename(`${item.id}-leitbild.png`),
                          item.leitbildUrl ?? item.leitbild!
                        )
                      }
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      PNG
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={cn("flex h-40 items-center justify-center rounded-xl border border-dashed text-sm", adminUi.dashedBox, adminUi.muted)}>
                  <ImageIcon className="mr-2 h-5 w-5 opacity-50" />
                  Kein Leitbild vorhanden
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdminOrdersTab({
  highlightOrderId,
  onHighlightConsumed,
}: {
  highlightOrderId?: string | null
  onHighlightConsumed?: () => void
} = {}) {
  const [orders, setOrders] = useState<StoredOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/orders")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setOrders(data.orders ?? [])
    } catch (err) {
      console.warn("Admin: Bestellungen konnten nicht geladen werden.", err)
      setError(
        err instanceof Error ? err.message : "Bestellungen konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  useEffect(() => {
    if (!highlightOrderId || loading) return
    setExpandedId(highlightOrderId)
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-order-id="${highlightOrderId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
      onHighlightConsumed?.()
    })
  }, [highlightOrderId, loading, onHighlightConsumed])

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    setUpdatingId(orderId)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Update fehlgeschlagen")
      setOrders((prev) =>
        prev.map((o) => (o.orderId === orderId ? data.order : o))
      )
    } catch (err) {
      console.warn("Admin: Status-Update fehlgeschlagen.", err)
      setError(
        err instanceof Error ? err.message : "Status konnte nicht aktualisiert werden."
      )
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-24", adminUi.loader)}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Bestellungen werden geladen…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className={cn("text-xl font-bold", adminUi.heading)}>Bestelluebersicht</h2>
          <p className={cn("text-sm", adminUi.muted)}>
            Produktions-Cockpit — {orders.length} Bestellung
            {orders.length !== 1 ? "en" : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadOrders()}
          className={adminUi.outlineBtn}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Aktualisieren
        </Button>
      </div>

      {error && <p className={adminUi.errorLg}>{error}</p>}

      {orders.length === 0 ? (
        <div className={cn("rounded-xl border border-dashed py-16 text-center", adminUi.empty)}>
          Noch keine Bestellungen erfasst.
        </div>
      ) : (
        <div className={adminUi.tableWrap}>
          <Table>
            <TableHeader>
              <TableRow className={adminUi.tableHeadRow}>
                <TableHead className={cn("w-10", adminUi.tableHead)} />
                <TableHead className={adminUi.tableHead}>Bestell-ID</TableHead>
                <TableHead className={adminUi.tableHead}>Datum</TableHead>
                <TableHead className={adminUi.tableHead}>Kunde</TableHead>
                <TableHead className={adminUi.tableHead}>Betrag</TableHead>
                <TableHead className={adminUi.tableHead}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const expanded = expandedId === order.orderId
                return (
                  <Fragment key={order.orderId}>
                    <TableRow
                      data-order-id={order.orderId}
                      className={cn(
                        "cursor-pointer",
                        adminUi.tableRow,
                        expanded && adminUi.tableRowExpanded,
                        highlightOrderId === order.orderId &&
                          "ring-1 ring-orange-500/40"
                      )}
                      onClick={() =>
                        setExpandedId(expanded ? null : order.orderId)
                      }
                    >
                      <TableCell className={adminUi.tableCellMuted}>
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className={cn("font-mono text-sm", adminUi.tableCell)}>
                        {order.orderId}
                      </TableCell>
                      <TableCell className={adminUi.bodyText}>
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell className={adminUi.tableCell}>
                        {customerName(order)}
                      </TableCell>
                      <TableCell className={cn("font-semibold", adminUi.accentTitle)}>
                        CHF {order.totals.total.toFixed(2)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={order.status}
                          disabled={updatingId === order.orderId}
                          onValueChange={(value) =>
                            void updateStatus(order.orderId, value as OrderStatus)
                          }
                        >
                          <SelectTrigger className={cn("h-9 w-[160px]", adminUi.select)}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={adminUi.card}>
                            {ORDER_STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="p-0">
                          <OrderDetailPanel order={order} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
