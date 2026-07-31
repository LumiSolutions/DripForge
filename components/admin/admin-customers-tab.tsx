"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  Check,
  Coins,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  UserRound,
  X,
} from "lucide-react"
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
import type { OrderAddress } from "@/lib/dripforge/submit-order"
import type { LoyaltyPointTransaction } from "@/lib/konto/loyalty-points-config"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type CustomerLoyaltyInfo = {
  points: number
  history: LoyaltyPointTransaction[]
  hasPortalAccount: boolean
  pointValueChf: number
  enabled: boolean
}

type StatusFilter = "alle" | "aktive" | "inaktive"
type AddressSection = "billing" | "delivery"

type AddressFormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  street: string
  zip: string
  city: string
  country: string
}

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

  if (status === "inaktiv") {
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300">
        Inaktiv
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

function addressToForm(
  address: OrderAddress | undefined | null,
  fallbackEmail = ""
): AddressFormState {
  return {
    firstName: address?.firstName ?? "",
    lastName: address?.lastName ?? "",
    email: address?.email || fallbackEmail,
    phone: address?.phone ?? "",
    street: address?.street ?? "",
    zip: address?.zip ?? "",
    city: address?.city ?? "",
    country: address?.country || "CH",
  }
}

function formToAddress(form: AddressFormState): OrderAddress {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    street: form.street.trim(),
    zip: form.zip.trim(),
    city: form.city.trim(),
    country: form.country.trim() || "CH",
  }
}

function AddressFields({
  form,
  onChange,
  disabled,
}: {
  form: AddressFormState
  onChange: (next: AddressFormState) => void
  disabled?: boolean
}) {
  const set = (key: keyof AddressFormState, value: string) =>
    onChange({ ...form, [key]: value })

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className={adminUi.label}>Vorname</Label>
        <Input
          value={form.firstName}
          onChange={(e) => set("firstName", e.target.value)}
          disabled={disabled}
          className={adminUi.input}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={adminUi.label}>Nachname</Label>
        <Input
          value={form.lastName}
          onChange={(e) => set("lastName", e.target.value)}
          disabled={disabled}
          className={adminUi.input}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className={adminUi.label}>E-Mail</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          disabled={disabled}
          className={adminUi.input}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className={adminUi.label}>Telefon</Label>
        <Input
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          disabled={disabled}
          className={adminUi.input}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className={adminUi.label}>Strasse</Label>
        <Input
          value={form.street}
          onChange={(e) => set("street", e.target.value)}
          disabled={disabled}
          className={adminUi.input}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={adminUi.label}>PLZ</Label>
        <Input
          value={form.zip}
          onChange={(e) => set("zip", e.target.value)}
          disabled={disabled}
          className={adminUi.input}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={adminUi.label}>Ort</Label>
        <Input
          value={form.city}
          onChange={(e) => set("city", e.target.value)}
          disabled={disabled}
          className={adminUi.input}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className={adminUi.label}>Land</Label>
        <Input
          value={form.country}
          onChange={(e) => set("country", e.target.value)}
          disabled={disabled}
          className={adminUi.input}
        />
      </div>
    </div>
  )
}

function AddressReadOnly({ address }: { address: OrderAddress }) {
  return (
    <dl className={cn("space-y-1 text-sm", adminUi.bodyText)}>
      <dd>
        {address.firstName} {address.lastName}
      </dd>
      <dd>{address.street}</dd>
      <dd>
        {address.zip} {address.city}
      </dd>
      <dd>{address.country}</dd>
      <dd className={cn("pt-2", adminUi.muted)}>
        Tel.: {address.phone || "—"}
      </dd>
      {address.email ? (
        <dd className={adminUi.muted}>{address.email}</dd>
      ) : null}
    </dl>
  )
}

type AdminCustomersTabProps = {
  onOpenOrder?: (orderId: string) => void
}

export function AdminCustomersTab({ onOpenOrder }: AdminCustomersTabProps) {
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [orders, setOrders] = useState<StoredOrder[]>([])
  const [loyalty, setLoyalty] = useState<CustomerLoyaltyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pointsDelta, setPointsDelta] = useState("")
  const [pointsNote, setPointsNote] = useState("")
  const [pointsDialogOpen, setPointsDialogOpen] = useState(false)
  const [pointsSaving, setPointsSaving] = useState(false)
  const [pointsError, setPointsError] = useState<string | null>(null)

  const [editingSection, setEditingSection] = useState<AddressSection | null>(null)
  const [addressForm, setAddressForm] = useState<AddressFormState | null>(null)
  const [statusDraft, setStatusDraft] = useState<"aktiv" | "inaktiv">("aktiv")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const filteredCustomers = useMemo(() => {
    if (statusFilter === "aktive") {
      return customers.filter((c) => c.status === "aktiv")
    }
    if (statusFilter === "inaktive") {
      return customers.filter(
        (c) => c.status === "inaktiv" || c.status === "gelöscht"
      )
    }
    return customers
  }, [customers, statusFilter])

  const resetEditState = useCallback(() => {
    setEditingSection(null)
    setAddressForm(null)
    setSaveError(null)
  }, [])

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
      const customer = (data.customer ?? null) as CustomerDetail | null
      setDetail(customer)
      if (customer) {
        const st = normalizeDetailStatus(customer.status)
        setStatusDraft(st === "inaktiv" ? "inaktiv" : "aktiv")
      }
      setOrders(data.orders ?? [])
      setLoyalty(
        data.loyalty
          ? {
              points: Number(data.loyalty.points) || 0,
              history: Array.isArray(data.loyalty.history)
                ? data.loyalty.history
                : [],
              hasPortalAccount: data.loyalty.hasPortalAccount === true,
              pointValueChf: Number(data.loyalty.pointValueChf) || 1,
              enabled: data.loyalty.enabled !== false,
            }
          : null
      )
      setPointsDelta("")
      setPointsNote("")
      setPointsError(null)
      setEditingSection(null)
      setAddressForm(null)
      setSaveError(null)
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
      setLoyalty(null)
      setPointsDelta("")
      setPointsNote("")
      setPointsError(null)
      resetEditState()
    }
  }, [selectedId, loadCustomerDetail, resetEditState])

  const selectCustomer = (kundennummer: string) => {
    setDeleteError(null)
    setPointsError(null)
    setSelectedId((prev) => (prev === kundennummer ? null : kundennummer))
  }

  const startEditAddress = (section: AddressSection) => {
    if (!detail) return
    setSaveError(null)
    setEditingSection(section)
    if (section === "billing") {
      setAddressForm(addressToForm(detail.billing, detail.email))
    } else {
      setAddressForm(
        addressToForm(detail.delivery ?? detail.billing, detail.email)
      )
    }
  }

  const cancelEditAddress = () => {
    resetEditState()
  }

  const patchCustomer = async (payload: {
    billing?: OrderAddress
    delivery?: OrderAddress | null
    email?: string
    status?: "aktiv" | "inaktiv"
  }) => {
    if (!detail) return false

    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(
        `/api/admin/customers/${encodeURIComponent(detail.kundennummer)}`,
        {
          method: "PATCH",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? "Speichern fehlgeschlagen.")
      }
      await Promise.all([
        loadCustomerDetail(detail.kundennummer),
        loadCustomers(),
      ])
      return true
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen."
      )
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAddress = async () => {
    if (!detail || !addressForm || !editingSection) return

    const address = formToAddress(addressForm)
    if (editingSection === "billing") {
      const ok = await patchCustomer({
        billing: address,
        email: address.email || detail.email,
      })
      if (ok) resetEditState()
      return
    }

    const ok = await patchCustomer({ delivery: address })
    if (ok) resetEditState()
  }

  const handleSaveStatus = async (next: "aktiv" | "inaktiv") => {
    setStatusDraft(next)
    if (!detail) return
    if (normalizeDetailStatus(detail.status) === next) return
    await patchCustomer({ status: next })
  }

  const parsedPointsDelta = (() => {
    const n = Math.trunc(Number(pointsDelta))
    return Number.isFinite(n) && n !== 0 ? n : null
  })()

  const canSubmitPointsAdjust =
    Boolean(detail) &&
    loyalty?.hasPortalAccount === true &&
    parsedPointsDelta != null &&
    pointsNote.trim().length > 0 &&
    !pointsSaving

  const handleAdjustPoints = async () => {
    if (!detail || parsedPointsDelta == null || !pointsNote.trim()) return

    setPointsSaving(true)
    setPointsError(null)
    try {
      const res = await fetch(
        `/api/admin/customers/${encodeURIComponent(detail.kundennummer)}/loyalty-points`,
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            delta: parsedPointsDelta,
            note: pointsNote.trim(),
          }),
        }
      )
      const data = (await res.json()) as { error?: string; points?: number }
      if (!res.ok) {
        throw new Error(data.error ?? "Punkte konnten nicht angepasst werden.")
      }
      setPointsDialogOpen(false)
      setPointsDelta("")
      setPointsNote("")
      await loadCustomerDetail(detail.kundennummer)
    } catch (err) {
      setPointsError(
        err instanceof Error
          ? err.message
          : "Punkte konnten nicht angepasst werden."
      )
    } finally {
      setPointsSaving(false)
    }
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
      setLoyalty(null)
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

  const detailStatus = detail ? normalizeDetailStatus(detail.status) : null
  const canEditCustomer = detailStatus != null && detailStatus !== "gelöscht"

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className={cn("text-xl font-bold", adminUi.heading)}>Kundenverwaltung</h2>
            <p className={cn("text-sm", adminUi.muted)}>
              {filteredCustomers.length}
              {statusFilter !== "alle" ? ` von ${customers.length}` : ""} Kunde
              {filteredCustomers.length !== 1 ? "n" : ""}
              {statusFilter === "alle" ? " erfasst" : ""}
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

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "alle", label: "Alle" },
              { id: "aktive", label: "Aktive" },
              { id: "inaktive", label: "Inaktive" },
            ] as const
          ).map((tab) => (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={statusFilter === tab.id ? "default" : "outline"}
              className={
                statusFilter === tab.id ? adminUi.primaryBtn : adminUi.outlineBtn
              }
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {error && !detail && <p className={adminUi.error}>{error}</p>}

        {customers.length === 0 ? (
          <div className={cn("rounded-xl border border-dashed py-16 text-center", adminUi.empty)}>
            Noch keine Kunden erfasst. Kunden werden bei Registrierung im Portal
            oder bei der ersten Bestellung angelegt (Format JJ-#####, z. B. 26-53719).
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className={cn("rounded-xl border border-dashed py-16 text-center", adminUi.empty)}>
            Keine Kunden für diesen Filter.
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
                {filteredCustomers.map((customer) => {
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
                  <CustomerStatusBadge status={detailStatus ?? "aktiv"} />
                </div>
                <h3 className={cn("mt-1 text-xl font-bold", adminUi.heading)}>{detail.name}</h3>
                <p className={cn("text-sm", adminUi.muted)}>{detail.email}</p>
                <p className={cn("mt-2 text-xs", adminUi.tableCellMuted)}>
                  Registriert / erfasst: {formatDate(detail.createdAt)}
                </p>

                {canEditCustomer && (
                  <div className="mt-4 max-w-xs space-y-1.5">
                    <Label className={adminUi.label}>Status</Label>
                    <Select
                      value={statusDraft}
                      onValueChange={(value) => {
                        if (value === "aktiv" || value === "inaktiv") {
                          void handleSaveStatus(value)
                        }
                      }}
                      disabled={saving}
                    >
                      <SelectTrigger className={cn("w-full", adminUi.input)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aktiv">Aktiv</SelectItem>
                        <SelectItem value="inaktiv">Inaktiv</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {saveError && (
                <p className={adminUi.error} role="alert">
                  {saveError}
                </p>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>
                      Rechnungsadresse
                    </h4>
                    {canEditCustomer && editingSection !== "billing" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={adminUi.accentTitle}
                        onClick={() => startEditAddress("billing")}
                        disabled={saving || editingSection === "delivery"}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Bearbeiten</span>
                      </Button>
                    )}
                  </div>
                  {editingSection === "billing" && addressForm ? (
                    <div className="space-y-3">
                      <AddressFields
                        form={addressForm}
                        onChange={setAddressForm}
                        disabled={saving}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className={adminUi.primaryBtn}
                          disabled={saving}
                          onClick={() => void handleSaveAddress()}
                        >
                          {saving ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Speichern
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={adminUi.outlineBtn}
                          disabled={saving}
                          onClick={cancelEditAddress}
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" />
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <AddressReadOnly address={detail.billing} />
                  )}
                </div>

                <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>
                      Lieferadresse
                    </h4>
                    {canEditCustomer && editingSection !== "delivery" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={adminUi.accentTitle}
                        onClick={() => startEditAddress("delivery")}
                        disabled={saving || editingSection === "billing"}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Bearbeiten</span>
                      </Button>
                    )}
                  </div>
                  {editingSection === "delivery" && addressForm ? (
                    <div className="space-y-3">
                      <AddressFields
                        form={addressForm}
                        onChange={setAddressForm}
                        disabled={saving}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className={adminUi.primaryBtn}
                          disabled={saving}
                          onClick={() => void handleSaveAddress()}
                        >
                          {saving ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Speichern
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={adminUi.outlineBtn}
                          disabled={saving}
                          onClick={cancelEditAddress}
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" />
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : detail.delivery ? (
                    <AddressReadOnly address={detail.delivery} />
                  ) : (
                    <p className={cn("text-sm", adminUi.muted)}>
                      Entspricht der Rechnungsadresse
                    </p>
                  )}
                </div>
              </div>

              <div className={cn("space-y-4 rounded-xl border p-4", adminUi.section)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4
                      className={cn(
                        "flex items-center gap-2 text-sm font-semibold",
                        adminUi.accentTitle
                      )}
                    >
                      <Coins className="h-4 w-4" />
                      Treuepunkte
                    </h4>
                    {loyalty ? (
                      <p className={cn("mt-1 text-2xl font-bold tabular-nums", adminUi.heading)}>
                        {loyalty.points}{" "}
                        <span className={cn("text-sm font-medium", adminUi.muted)}>
                          Punkte
                          {loyalty.enabled
                            ? ` · CHF ${(loyalty.points * loyalty.pointValueChf).toFixed(2)}`
                            : " · System deaktiviert"}
                        </span>
                      </p>
                    ) : (
                      <p className={cn("mt-1 text-sm", adminUi.muted)}>Keine Punkte-Daten</p>
                    )}
                  </div>
                </div>

                {!loyalty?.hasPortalAccount ? (
                  <p className={cn("text-sm", adminUi.muted)}>
                    Kein Portal-Konto verknüpft — manuelle Punkteanpassung nicht möglich.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <div className="space-y-2">
                      <Label className={adminUi.label}>Änderung (+/− Punkte)</Label>
                      <Input
                        type="number"
                        step={1}
                        value={pointsDelta}
                        onChange={(e) => {
                          setPointsDelta(e.target.value)
                          setPointsError(null)
                        }}
                        placeholder="z. B. 50 oder -20"
                        className={adminUi.input}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className={adminUi.label}>Grund / Notiz</Label>
                      <Input
                        value={pointsNote}
                        onChange={(e) => {
                          setPointsNote(e.target.value)
                          setPointsError(null)
                        }}
                        placeholder="z. B. Kulanz, Korrektur…"
                        maxLength={500}
                        className={adminUi.input}
                      />
                    </div>
                    <div className="flex items-end">
                      <AlertDialog
                        open={pointsDialogOpen}
                        onOpenChange={(open) => {
                          if (pointsSaving) return
                          setPointsDialogOpen(open)
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            className={adminUi.primaryBtn}
                            disabled={!canSubmitPointsAdjust}
                            onClick={(e) => {
                              if (!canSubmitPointsAdjust) {
                                e.preventDefault()
                                return
                              }
                              setPointsDialogOpen(true)
                            }}
                          >
                            Anpassen
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Punkte wirklich anpassen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {parsedPointsDelta != null && detail ? (
                                <>
                                  Möchtest du dem Kunden{" "}
                                  <strong>{detail.name}</strong> wirklich{" "}
                                  <strong>
                                    {Math.abs(parsedPointsDelta)} Punkte{" "}
                                    {parsedPointsDelta > 0 ? "gutschreiben" : "abziehen"}
                                  </strong>
                                  ?
                                  <br />
                                  Notiz: {pointsNote.trim()}
                                </>
                              ) : (
                                "Bitte Betrag und Notiz prüfen."
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          {pointsError && (
                            <p className="text-sm text-red-500" role="alert">
                              {pointsError}
                            </p>
                          )}
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={pointsSaving}>
                              Abbrechen
                            </AlertDialogCancel>
                            <Button
                              type="button"
                              disabled={pointsSaving || !canSubmitPointsAdjust}
                              className={adminUi.primaryBtn}
                              onClick={() => void handleAdjustPoints()}
                            >
                              {pointsSaving ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Speichern…
                                </>
                              ) : (
                                "Ja, speichern"
                              )}
                            </Button>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}

                {pointsError && !pointsDialogOpen && (
                  <p className={adminUi.error} role="alert">
                    {pointsError}
                  </p>
                )}

                {loyalty && loyalty.history.length > 0 && (
                  <div className="space-y-2">
                    <p className={cn("text-xs font-medium", adminUi.muted)}>
                      Letzte Punktebewegungen
                    </p>
                    <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                      {loyalty.history.map((tx) => (
                        <li
                          key={tx.id}
                          className={cn(
                            "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2",
                            adminUi.detailPanel
                          )}
                        >
                          <span className={adminUi.bodyText}>
                            <span
                              className={cn(
                                "font-mono tabular-nums",
                                tx.points >= 0 ? "text-emerald-600" : "text-red-600"
                              )}
                            >
                              {tx.points > 0 ? "+" : ""}
                              {tx.points}
                            </span>{" "}
                            {tx.note?.trim() || tx.type}
                          </span>
                          <span className={cn("text-xs", adminUi.muted)}>
                            {formatDate(tx.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
