"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
  UserRound,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CustomerListItem } from "@/lib/admin/customers"
import {
  ORDER_STATUS_OPTIONS,
  type StoredCustomer,
  type StoredOrder,
} from "@/lib/admin/types"
import type { CustomerAccountStatus } from "@/lib/konto/account-status"
import { normalizeAccountStatus } from "@/lib/konto/account-status"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

function normalizeDetailStatus(status: unknown): CustomerAccountStatus {
  return normalizeAccountStatus(status)
}

type CustomerDetail = StoredCustomer & { name: string; status: CustomerAccountStatus }

function CustomerStatusBadge({ status }: { status: CustomerAccountStatus }) {
  if (status === "gelöscht") {
    return (
      <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300">
        Gelöscht
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
      Aktiv
    </Badge>
  )
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))
}

function statusLabel(status: StoredOrder["status"]) {
  return ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

type AdminCustomersTabProps = {
  onOpenOrder?: (orderId: string) => void
}

export function AdminCustomersTab({ onOpenOrder }: AdminCustomersTabProps) {
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [orders, setOrders] = useState<StoredOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/customers")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setCustomers(data.customers ?? [])
    } catch (err) {
      console.warn("Admin: Kunden konnten nicht geladen werden.", err)
      setError(
        err instanceof Error ? err.message : "Kunden konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCustomerDetail = useCallback(async (kundennummer: string) => {
    setDetailLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/customers/${encodeURIComponent(kundennummer)}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setDetail(data.customer ?? null)
      setOrders(data.orders ?? [])
    } catch (err) {
      console.warn("Admin: Kundendetails konnten nicht geladen werden.", err)
      setError(
        err instanceof Error
          ? err.message
          : "Kundendetails konnten nicht geladen werden."
      )
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    if (selectedId) {
      void loadCustomerDetail(selectedId)
    } else {
      setDetail(null)
      setOrders([])
    }
  }, [selectedId, loadCustomerDetail])

  const selectCustomer = (kundennummer: string) => {
    setDeleteError(null)
    setSelectedId((prev) => (prev === kundennummer ? null : kundennummer))
  }

  const handleHardDelete = async () => {
    if (!detail) return

    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch("/api/admin/delete-customer", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: detail.kundennummer }),
      })

      let data: { error?: string; success?: boolean } = {}
      try {
        data = (await res.json()) as typeof data
      } catch {
        throw new Error("Server-Antwort ungültig.")
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Kunde konnte nicht gelöscht werden.")
      }

      setDeleteDialogOpen(false)
      setSelectedId(null)
      setDetail(null)
      setOrders([])
      await loadCustomers()
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Kunde konnte nicht gelöscht werden."
      )
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-24", adminUi.loader)}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Kunden werden geladen…
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className={cn("text-xl font-bold", adminUi.heading)}>Kundenverwaltung</h2>
            <p className={cn("text-sm", adminUi.muted)}>
              {customers.length} Kunde{customers.length !== 1 ? "n" : ""} erfasst
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadCustomers()}
            className={adminUi.outlineBtn}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
        </div>

        {error && !detail && <p className={adminUi.error}>{error}</p>}

        {customers.length === 0 ? (
          <div className={cn("rounded-xl border border-dashed py-16 text-center", adminUi.empty)}>
            Noch keine Kunden erfasst. Kunden werden bei Registrierung im Portal
            oder bei der ersten Bestellung angelegt (Format JJ-#####, z. B. 26-53719).
          </div>
        ) : (
          <div className={adminUi.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow className={adminUi.tableHeadRow}>
                  <TableHead className={adminUi.tableHead}>Kundennr.</TableHead>
                  <TableHead className={adminUi.tableHead}>Name</TableHead>
                  <TableHead className={adminUi.tableHead}>Status</TableHead>
                  <TableHead className={cn("hidden md:table-cell", adminUi.tableHead)}>
                    Registriert
                  </TableHead>
                  <TableHead className={cn("text-right", adminUi.tableHead)}>Best.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => {
                  const active = selectedId === customer.kundennummer
                  return (
                    <TableRow
                      key={customer.kundennummer}
                      className={cn(
                        "cursor-pointer",
                        adminUi.tableRow,
                        active && adminUi.listItemActive
                      )}
                      onClick={() => selectCustomer(customer.kundennummer)}
                    >
                      <TableCell className={cn("font-mono text-xs", adminUi.accentTitle)}>
                        {customer.kundennummer}
                      </TableCell>
                      <TableCell>
                        <p className={cn("font-medium", adminUi.heading)}>{customer.name}</p>
                        <p className={cn("text-xs", adminUi.muted)}>{customer.email}</p>
                      </TableCell>
                      <TableCell>
                        <CustomerStatusBadge status={customer.status} />
                      </TableCell>
                      <TableCell className={cn("hidden md:table-cell text-xs", adminUi.muted)}>
                        {formatDate(customer.createdAt)}
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums", adminUi.bodyText)}>
                        {customer.orderCount}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Card className={cn(adminUi.card, "lg:col-span-3")}>
        <CardContent className="space-y-6 p-6">
          {!selectedId ? (
            <div className={cn("flex min-h-[320px] flex-col items-center justify-center text-center", adminUi.muted)}>
              <UserRound className="mb-3 h-10 w-10 opacity-30" />
              <p>Kunde auswählen für Stammdaten und Bestellhistorie</p>
            </div>
          ) : detailLoading ? (
            <div className={cn("flex min-h-[320px] items-center justify-center", adminUi.loader)}>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Kundendetails werden geladen…
            </div>
          ) : detail ? (
            <>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn("font-mono text-sm", adminUi.accentTitle)}>
                    {detail.kundennummer}
                  </p>
                  <CustomerStatusBadge
                    status={normalizeDetailStatus(detail.status)}
                  />
                </div>
                <h3 className={cn("mt-1 text-xl font-bold", adminUi.heading)}>{detail.name}</h3>
                <p className={cn("text-sm", adminUi.muted)}>{detail.email}</p>
                <p className={cn("mt-2 text-xs", adminUi.tableCellMuted)}>
                  Registriert / erfasst: {formatDate(detail.createdAt)}
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
                  <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>
                    Rechnungsadresse
                  </h4>
                  <dl className={cn("space-y-1 text-sm", adminUi.bodyText)}>
                    <dd>
                      {detail.billing.firstName} {detail.billing.lastName}
                    </dd>
                    <dd>{detail.billing.street}</dd>
                    <dd>
                      {detail.billing.zip} {detail.billing.city}
                    </dd>
                    <dd>{detail.billing.country}</dd>
                    <dd className={cn("pt-2", adminUi.muted)}>
                      Tel.: {detail.billing.phone || "—"}
                    </dd>
                  </dl>
                </div>

                <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
                  <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>
                    Lieferadresse
                  </h4>
                  {detail.delivery ? (
                    <dl className={cn("space-y-1 text-sm", adminUi.bodyText)}>
                      <dd>
                        {detail.delivery.firstName} {detail.delivery.lastName}
                      </dd>
                      <dd>{detail.delivery.street}</dd>
                      <dd>
                        {detail.delivery.zip} {detail.delivery.city}
                      </dd>
                      <dd>{detail.delivery.country}</dd>
                      <dd className={cn("pt-2", adminUi.muted)}>
                        Tel.: {detail.delivery.phone || "—"}
                      </dd>
                    </dl>
                  ) : (
                    <p className={cn("text-sm", adminUi.muted)}>
                      Entspricht der Rechnungsadresse
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>
                  Bestellhistorie ({orders.length})
                </h4>
                {orders.length === 0 ? (
                  <p className={cn("text-sm", adminUi.muted)}>Keine Bestellungen verknuepft.</p>
                ) : (
                  <div className="space-y-2">
                    {orders.map((order) => (
                      <div
                        key={order.orderId}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
                          adminUi.detailPanel
                        )}
                      >
                        <div className="min-w-0">
                          <p className={cn("font-mono text-sm", adminUi.tableCell)}>
                            {order.orderId}
                          </p>
                          <p className={cn("text-xs", adminUi.muted)}>
                            {formatDate(order.createdAt)} · CHF{" "}
                            {order.totals.total.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={adminUi.badgeOutline}>
                            {statusLabel(order.status)}
                          </Badge>
                          {onOpenOrder && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className={cn("hover:text-orange-300", adminUi.accentTitle)}
                              onClick={() => onOpenOrder(order.orderId)}
                            >
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                              Bestellung
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className={cn("flex items-center gap-2 text-xs", adminUi.tableCellMuted)}>
                <ArrowRight className="h-3 w-3" />
                Kunden werden bei Portal-Registrierung oder Gastbestellung
                automatisch angelegt (Format JJ-#####, z. B. 26-53719).
              </p>

              <div className={cn("border-t pt-6", adminUi.section)}>
                <AlertDialog
                  open={deleteDialogOpen}
                  onOpenChange={(open) => {
                    if (deleting) return
                    setDeleteDialogOpen(open)
                    if (!open) setDeleteError(null)
                  }}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Kunde unwiderruflich löschen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Kunde unwiderruflich löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Achtung: Dies löscht den User komplett aus der CosmosDB. Die
                        E-Mail-Adresse wird wieder freigegeben. Diese Aktion kann nicht
                        rückgängig gemacht werden!
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
                        disabled={deleting}
                        onClick={() => void handleHardDelete()}
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
            </>
          ) : (
            <p className={adminUi.error}>Kunde konnte nicht geladen werden.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
