"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { getItemDownloadLinks, getItemMockupSrc } from "@/lib/admin/item-downloads"
import {
  getItemLogoPreviewSrc,
  getLaserPlacementLines,
} from "@/lib/admin/layout-placement"
import {
  ORDER_STATUS_OPTIONS,
  type OrderStatus,
  type ProductionStatus,
  type StoredOrder,
} from "@/lib/admin/types"
import {
  isOrderPaid,
  needsManualPaymentConfirmation,
  PRODUCTION_COLUMNS,
  resolveProductionStatus,
} from "@/lib/admin/production-status"
import { formatBelegDisplayId } from "@/lib/documents/beleg-number"
import { LASER_FONT_OPTIONS } from "@/lib/dripforge/laser-fonts"
import { getLaserFontFamily } from "@/lib/dripforge/laser-fonts"
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

function triggerAdminFileDownload(filename: string, href: string) {
  if (href.startsWith("data:")) {
    downloadDataUrl(filename, href)
    return
  }
  const link = document.createElement("a")
  link.href = href
  link.download = filename
  link.rel = "noopener"
  if (href.startsWith("/api/")) link.target = "_blank"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
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
                      <span className={adminUi.muted}>Farbwünsche:</span>{" "}
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
                  {item.customDetails?.userFont &&
                    !(item.customDetails.layoutCoordinates?.layers ?? []).some(
                      (l) => l.kind === "text"
                    ) && (
                    <li>
                      <span className={adminUi.muted}>Schriftart:</span>{" "}
                      {fontLabel(item.customDetails.userFont)}
                    </li>
                  )}
                  {(item.customDetails?.layoutCoordinates?.layers ?? [])
                    .filter((l) => l.kind === "text" && (l.text ?? "").trim())
                    .map((layer, index) => (
                      <li key={layer.id}>
                        <span className={adminUi.muted}>
                          Text {index + 1} / Schrift:
                        </span>{" "}
                        <span
                          style={{
                            fontFamily: layer.fontId
                              ? getLaserFontFamily(layer.fontId as never)
                              : undefined,
                          }}
                        >
                          {fontLabel(layer.fontId) || "Standard"}
                        </span>
                        <span className={adminUi.muted}> — </span>
                        <span
                          style={{
                            fontFamily: layer.fontId
                              ? getLaserFontFamily(layer.fontId as never)
                              : undefined,
                          }}
                        >
                          {(layer.text ?? "").trim()}
                        </span>
                      </li>
                    ))}
                  {getLaserPlacementLines(item).map((line) => (
                    <li key={`${line.label}-${line.value}`}>
                      <span className={adminUi.muted}>{line.label}:</span>{" "}
                      {line.value}
                    </li>
                  ))}
                </ul>
              )}

              {item.type === "laser" &&
                (getItemMockupSrc(item) || getItemLogoPreviewSrc(item)) && (
                <div className="flex items-start gap-3 pt-2">
                  <div className={cn("overflow-hidden rounded-lg border", adminUi.thumbnail)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getItemMockupSrc(item) ?? getItemLogoPreviewSrc(item)!}
                      alt={
                        getItemMockupSrc(item)
                          ? "Vorschau-Mockup"
                          : "Logo-Vorschau"
                      }
                      className="h-24 w-32 object-contain bg-black/20"
                    />
                  </div>
                  <div className={cn("space-y-1 text-xs", adminUi.bodyText)}>
                    <p className="font-medium">
                      {getItemMockupSrc(item)
                        ? "Kombiniertes Vorschau-Mockup"
                        : "Hochgeladene Grafik"}
                    </p>
                    {getLaserPlacementLines(item)
                      .filter((l) => l.label.startsWith("Logo"))
                      .map((line) => (
                        <p key={line.value}>
                          <span className="font-medium">Position:</span> {line.value}
                        </p>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {(() => {
                  const links = getItemDownloadLinks(order.orderId, item)
                  return (
                    <>
                      {links.map((file) => (
                        <Button
                          key={file.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          className={adminUi.outlineBtn}
                          onClick={() =>
                            triggerAdminFileDownload(file.filename, file.href)
                          }
                        >
                          <Download className="mr-2 h-3.5 w-3.5" />
                          {file.label}
                        </Button>
                      ))}
                      {item.customDetails?.fileName &&
                        !links.some((f) => f.role === "stl") && (
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
                            STL-Datei herunterladen
                          </Button>
                        )}
                    </>
                  )
                })()}
              </div>
            </div>

            <div className="space-y-3">
              <h5 className={cn("text-xs font-semibold uppercase tracking-wide", adminUi.muted)}>
                {item.type === "laser"
                  ? "Qualitätssicherung — Vorschau-Mockup"
                  : "Qualitätssicherung — Leitbild"}
              </h5>
              {getItemMockupSrc(item) ? (
                <div className={cn("overflow-hidden rounded-xl border bg-black/40", adminUi.thumbnail)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getItemMockupSrc(item)!}
                    alt={
                      item.type === "laser"
                        ? "Vorschau-Mockup (Hintergrund + Overlay)"
                        : "Leitbild Kunden-Wunsch-Ansicht"
                    }
                    className="max-h-80 w-full object-contain"
                  />
                  <div className={cn("flex items-center justify-between gap-2 border-t px-3 py-2", adminUi.sidebarBorder)}>
                    <span className={cn("text-xs", adminUi.muted)}>
                      {item.type === "laser"
                        ? "Composite-Snapshot beim Warenkorb (Hintergrund + Logo/Text)"
                        : "Snapshot beim Warenkorb-Hinzufuegen"}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn("hover:text-orange-300", adminUi.accentTitle)}
                      onClick={() =>
                        triggerAdminFileDownload(
                          sanitizeFilename(
                            `${item.id}-${item.type === "laser" ? "mockup" : "leitbild"}.png`
                          ),
                          getItemMockupSrc(item)!
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
                  {item.type === "laser"
                    ? "Kein Vorschau-Mockup vorhanden"
                    : "Kein Leitbild vorhanden"}
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
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [newOrderNotice, setNewOrderNotice] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [amountFrom, setAmountFrom] = useState("")
  const [amountTo, setAmountTo] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const knownOrderIdsRef = useRef<Set<string> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const playNewOrderChime = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!AudioCtx) return
      const ctx = audioCtxRef.current ?? new AudioCtx()
      audioCtxRef.current = ctx
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = 880
      gain.gain.value = 0.04
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
      osc.stop(ctx.currentTime + 0.35)
    } catch {
      /* Audio optional */
    }
  }, [])

  const loadOrders = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      const nextOrders = (data.orders ?? []) as StoredOrder[]

      const nextIds = new Set(nextOrders.map((o) => o.orderId))
      if (knownOrderIdsRef.current) {
        const fresh = nextOrders.filter(
          (o) => !knownOrderIdsRef.current!.has(o.orderId)
        )
        if (fresh.length > 0) {
          const newest = fresh[0]
          setNewOrderNotice(
            fresh.length === 1
              ? `Neue Bestellung: ${newest.orderId}`
              : `${fresh.length} neue Bestellungen eingegangen`
          )
          playNewOrderChime()
        }
      }
      knownOrderIdsRef.current = nextIds
      setOrders(nextOrders)
    } catch (err) {
      console.warn("Admin: Bestellungen konnten nicht geladen werden.", err)
      if (!opts?.silent) {
        setError(
          err instanceof Error
            ? err.message
            : "Bestellungen konnten nicht geladen werden."
        )
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [playNewOrderChime])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadOrders({ silent: true })
    }, 20_000)
    return () => window.clearInterval(timer)
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

  const filtersActive =
    searchQuery.trim() !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    amountFrom !== "" ||
    amountTo !== "" ||
    statusFilter !== "all"

  const resetFilters = () => {
    setSearchQuery("")
    setDateFrom("")
    setDateTo("")
    setAmountFrom("")
    setAmountTo("")
    setStatusFilter("all")
  }

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const minAmount = amountFrom.trim() === "" ? null : Number(amountFrom)
    const maxAmount = amountTo.trim() === "" ? null : Number(amountTo)
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null

    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false

      if (fromTs != null || toTs != null) {
        const created = new Date(order.createdAt).getTime()
        if (Number.isNaN(created)) return false
        if (fromTs != null && created < fromTs) return false
        if (toTs != null && created > toTs) return false
      }

      if (minAmount != null || maxAmount != null) {
        const total = order.totals.total
        if (minAmount != null && !Number.isNaN(minAmount) && total < minAmount) {
          return false
        }
        if (maxAmount != null && !Number.isNaN(maxAmount) && total > maxAmount) {
          return false
        }
      }

      if (q) {
        const haystack = [
          order.orderId,
          order.invoiceNumber ?? "",
          customerName(order),
          order.billing.email,
          order.kundennummer ?? "",
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [
    amountFrom,
    amountTo,
    dateFrom,
    dateTo,
    orders,
    searchQuery,
    statusFilter,
  ])

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

  const updateProductionStatus = async (
    orderId: string,
    productionStatus: ProductionStatus
  ) => {
    setUpdatingId(orderId)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Update fehlgeschlagen")
      setOrders((prev) =>
        prev.map((o) => (o.orderId === orderId ? data.order : o))
      )
    } catch (err) {
      console.warn("Admin: Produktionsstatus-Update fehlgeschlagen.", err)
      setError(
        err instanceof Error ? err.message : "Status konnte nicht aktualisiert werden."
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const confirmOrderPayment = async (orderId: string) => {
    setUpdatingId(orderId)
    try {
      const res = await fetch(`/api/admin/orders/update-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, confirmPayment: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Zahlungsbestätigung fehlgeschlagen")
      setOrders((prev) =>
        prev.map((o) => (o.orderId === orderId ? data.order : o))
      )
    } catch (err) {
      console.warn("Admin: Zahlungsbestätigung fehlgeschlagen.", err)
      setError(
        err instanceof Error ? err.message : "Zahlung konnte nicht bestätigt werden."
      )
    } finally {
      setUpdatingId(null)
    }
  }

  /** Belege-Statusauswahl: Pipeline-Stufen + Storno + manuelle Zahlungsbestätigung. */
  const handleBelegeStatusChange = (order: StoredOrder, value: string) => {
    if (value === "storniert") {
      void updateStatus(order.orderId, "storniert")
      return
    }
    if (value === "bezahlt" && !isOrderPaid(order)) {
      void confirmOrderPayment(order.orderId)
      return
    }
    void updateProductionStatus(order.orderId, value as ProductionStatus)
  }

  const deleteOrder = async (orderId: string) => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Bestellung konnte nicht gelöscht werden."
        )
      }
      setOrders((prev) => prev.filter((o) => o.orderId !== orderId))
      setExpandedId((current) => (current === orderId ? null : current))
      setDeleteTargetId(null)
    } catch (err) {
      console.warn("Admin: Bestellung löschen fehlgeschlagen.", err)
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Bestellung konnte nicht gelöscht werden."
      )
    } finally {
      setDeleting(false)
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
      {newOrderNotice ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100"
        >
          <span className="font-medium">{newOrderNotice}</span>
          <button
            type="button"
            className="text-xs font-semibold underline underline-offset-2"
            onClick={() => setNewOrderNotice(null)}
          >
            Schliessen
          </button>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className={cn("text-xl font-bold", adminUi.heading)}>Bestellübersicht</h2>
          <p className={cn("text-sm", adminUi.muted)}>
            Produktions-Cockpit — {filteredOrders.length}
            {filtersActive ? ` von ${orders.length}` : ""} Bestellung
            {filteredOrders.length !== 1 ? "en" : ""}
            <span className="ml-2 text-xs opacity-70">(Auto-Refresh 20s)</span>
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

      <Card className={adminUi.section}>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1">
              <Label className={cn("text-xs", adminUi.label)}>Suche</Label>
              <div className="relative">
                <Search
                  className={cn(
                    "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                    adminUi.muted
                  )}
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Bestell-ID, Kunde, E-Mail…"
                  className={cn("pl-9", adminUi.input)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className={cn("text-xs", adminUi.label)}>Status</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={cn("h-10 rounded-md border px-3 text-sm", adminUi.select)}
              >
                <option value="all">Alle</option>
                {ORDER_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {filtersActive ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn("h-10 text-xs", adminUi.muted)}
                onClick={resetFilters}
              >
                Filter zurücksetzen
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className={cn("text-xs", adminUi.label)}>Datum von</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={adminUi.input}
              />
            </div>
            <div className="space-y-1">
              <Label className={cn("text-xs", adminUi.label)}>Datum bis</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={adminUi.input}
              />
            </div>
            <div className="space-y-1">
              <Label className={cn("text-xs", adminUi.label)}>Betrag von (CHF)</Label>
              <Input
                type="number"
                min={0}
                step={0.05}
                inputMode="decimal"
                value={amountFrom}
                onChange={(e) => setAmountFrom(e.target.value)}
                placeholder="0.00"
                className={adminUi.input}
              />
            </div>
            <div className="space-y-1">
              <Label className={cn("text-xs", adminUi.label)}>Betrag bis (CHF)</Label>
              <Input
                type="number"
                min={0}
                step={0.05}
                inputMode="decimal"
                value={amountTo}
                onChange={(e) => setAmountTo(e.target.value)}
                placeholder="0.00"
                className={adminUi.input}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <p className={adminUi.errorLg}>{error}</p>}

      {orders.length === 0 ? (
        <div className={cn("rounded-xl border border-dashed py-16 text-center", adminUi.empty)}>
          Noch keine Bestellungen erfasst.
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className={cn("rounded-xl border border-dashed py-16 text-center", adminUi.empty)}>
          Keine Bestellungen für die aktuellen Filter.
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
                <TableHead className={cn("w-12 text-right", adminUi.tableHead)}>
                  <span className="sr-only">Löschen</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
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
                        <div>
                          {order.invoiceNumber
                            ? formatBelegDisplayId(order.invoiceNumber)
                            : order.orderId}
                        </div>
                        {order.invoiceNumber ? (
                          <div className="text-xs text-muted-foreground">
                            Bestell-Ref: {order.orderId}
                          </div>
                        ) : null}
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
                        <div className="flex flex-col gap-1.5">
                          <Select
                            value={
                              order.status === "storniert"
                                ? "storniert"
                                : resolveProductionStatus(order)
                            }
                            disabled={updatingId === order.orderId}
                            onValueChange={(value) =>
                              handleBelegeStatusChange(order, value)
                            }
                          >
                            <SelectTrigger className={cn("h-9 w-[200px]", adminUi.select)}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className={adminUi.card}>
                              {PRODUCTION_COLUMNS.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                              <SelectItem value="storniert">Storniert</SelectItem>
                            </SelectContent>
                          </Select>
                          {needsManualPaymentConfirmation(order) && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={updatingId === order.orderId}
                              className="h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                              onClick={() => void confirmOrderPayment(order.orderId)}
                            >
                              Zahlungseingang bestätigen
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-red-500 hover:bg-red-500/10 hover:text-red-400"
                          aria-label={`Bestellung ${order.orderId} löschen`}
                          disabled={deleting && deleteTargetId === order.orderId}
                          onClick={() => {
                            setDeleteError(null)
                            setDeleteTargetId(order.orderId)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="p-0">
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

      <AlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => {
          if (deleting) return
          if (!open) {
            setDeleteTargetId(null)
            setDeleteError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestellung unwiderruflich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du die Bestellung{" "}
              <span className="font-mono font-medium text-foreground">
                {deleteTargetId}
              </span>{" "}
              wirklich unwiderruflich löschen? Diese Aktion kann nicht rückgängig gemacht
              werden und entfernt die Bestellung auch aus allen Umsatzstatistiken.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-red-500" role="alert">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting || !deleteTargetId}
              onClick={() => {
                if (deleteTargetId) void deleteOrder(deleteTargetId)
              }}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gelöscht…
                </>
              ) : (
                "Ja, unwiderruflich löschen"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
