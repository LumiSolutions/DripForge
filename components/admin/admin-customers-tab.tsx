"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
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
import type { SavedCustomerDesign } from "@/lib/konto/account-types"
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
type SortDirection = "asc" | "desc"
type CustomerSortColumn =
  | "kundennummer"
  | "name"
  | "status"
  | "createdAt"
  | "orderCount"
type OrderSortColumn = "createdAt" | "total" | "status"

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const
const DETAIL_CACHE_TTL_MS = 60_000

type DetailCacheEntry = {
  detail: CustomerDetail
  orders: StoredOrder[]
  loyalty: CustomerLoyaltyInfo | null
  designs: SavedCustomerDesign[]
  fetchedAt: number
}

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

function statusRank(status: CustomerAccountStatus): number {
  if (status === "aktiv") return 0
  if (status === "inaktiv") return 1
  return 2
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "de-CH", { sensitivity: "base" })
}

function toggleSortDirection(direction: SortDirection): SortDirection {
  return direction === "asc" ? "desc" : "asc"
}

function defaultCustomerSortDirection(column: CustomerSortColumn): SortDirection {
  if (column === "createdAt" || column === "orderCount") return "desc"
  return "asc"
}

function defaultOrderSortDirection(column: OrderSortColumn): SortDirection {
  if (column === "status") return "asc"
  return "desc"
}

function customerMatchesSearch(customer: CustomerListItem, query: string): boolean {
  if (!query) return true
  const haystack = [
    customer.name,
    customer.email,
    customer.status,
    customer.createdAt,
    formatDate(customer.createdAt),
    customer.city,
    customer.street,
    customer.zip,
    customer.country,
    customer.phone,
    customer.kundennummer,
    customer.firstName,
    customer.lastName,
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(query)
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

function CustomerDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Kundendetails werden geladen">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-2 h-10 w-40" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  )
}

function SortableHead({
  label,
  active,
  direction,
  onClick,
  className,
  align = "left",
}: {
  label: string
  active: boolean
  direction: SortDirection
  onClick: () => void
  className?: string
  align?: "left" | "right"
}) {
  return (
    <TableHead className={cn(adminUi.tableHead, className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-0.5 font-medium hover:text-foreground",
          align === "right" && "ml-auto flex-row-reverse",
          active ? adminUi.heading : adminUi.muted
        )}
      >
        {label}
        {active ? (
          direction === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )
        ) : (
          <ChevronDown className="h-3.5 w-3.5 opacity-30" aria-hidden />
        )}
      </button>
    </TableHead>
  )
}

type AdminCustomersTabProps = {
  onOpenOrder?: (orderId: string) => void
}

export function AdminCustomersTab({ onOpenOrder }: AdminCustomersTabProps) {
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortColumn, setSortColumn] = useState<CustomerSortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [pageSize, setPageSize] = useState<number>(50)
  const [visibleCount, setVisibleCount] = useState(50)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [orders, setOrders] = useState<StoredOrder[]>([])
  const [loyalty, setLoyalty] = useState<CustomerLoyaltyInfo | null>(null)
  const [designs, setDesigns] = useState<SavedCustomerDesign[]>([])
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

  const [ordersExpanded, setOrdersExpanded] = useState(false)
  const [orderSearch, setOrderSearch] = useState("")
  const [orderDateFrom, setOrderDateFrom] = useState("")
  const [orderDateTo, setOrderDateTo] = useState("")
  const [orderAmountFrom, setOrderAmountFrom] = useState("")
  const [orderAmountTo, setOrderAmountTo] = useState("")
  const [orderStatusFilter, setOrderStatusFilter] = useState("all")
  const [orderSortColumn, setOrderSortColumn] = useState<OrderSortColumn | null>(null)
  const [orderSortDirection, setOrderSortDirection] = useState<SortDirection>("desc")

  const detailCacheRef = useRef<Map<string, DetailCacheEntry>>(new Map())
  const detailKundennummerRef = useRef<string | null>(null)

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    let list = customers
    if (statusFilter === "aktive") {
      list = list.filter((c) => c.status === "aktiv")
    } else if (statusFilter === "inaktive") {
      list = list.filter((c) => c.status === "inaktiv" || c.status === "gelöscht")
    }

    if (q) {
      list = list.filter((c) => customerMatchesSearch(c, q))
    }

    const sorted = [...list]
    sorted.sort((a, b) => {
      if (sortColumn) {
        let cmp = 0
        switch (sortColumn) {
          case "kundennummer":
            cmp = compareText(a.kundennummer, b.kundennummer)
            break
          case "name":
            cmp = compareText(a.name, b.name)
            break
          case "status":
            cmp = statusRank(a.status) - statusRank(b.status)
            if (cmp === 0) cmp = compareText(a.status, b.status)
            break
          case "createdAt":
            cmp = a.createdAt.localeCompare(b.createdAt)
            break
          case "orderCount":
            cmp = a.orderCount - b.orderCount
            break
        }
        if (cmp !== 0) return sortDirection === "asc" ? cmp : -cmp
        const activeCmp = statusRank(a.status) - statusRank(b.status)
        if (activeCmp !== 0) return activeCmp
        return compareText(a.name, b.name)
      }

      const activeCmp = statusRank(a.status) - statusRank(b.status)
      if (activeCmp !== 0) return activeCmp
      return compareText(a.name, b.name)
    })

    return sorted
  }, [customers, searchQuery, sortColumn, sortDirection, statusFilter])

  const visibleCustomers = useMemo(
    () => filteredCustomers.slice(0, visibleCount),
    [filteredCustomers, visibleCount]
  )

  const hasMoreCustomers = visibleCount < filteredCustomers.length

  useEffect(() => {
    setVisibleCount(pageSize)
  }, [pageSize, searchQuery, statusFilter, sortColumn, sortDirection])

  const resetEditState = useCallback(() => {
    setEditingSection(null)
    setAddressForm(null)
    setSaveError(null)
  }, [])

  const resetOrderFilters = useCallback(() => {
    setOrderSearch("")
    setOrderDateFrom("")
    setOrderDateTo("")
    setOrderAmountFrom("")
    setOrderAmountTo("")
    setOrderStatusFilter("all")
    setOrderSortColumn(null)
    setOrderSortDirection("desc")
  }, [])

  const applyDetailPayload = useCallback(
    (
      customer: CustomerDetail | null,
      nextOrders: StoredOrder[],
      nextLoyalty: CustomerLoyaltyInfo | null,
      nextDesigns: SavedCustomerDesign[] = [],
      options?: { resetOrderUi?: boolean }
    ) => {
      const resetOrderUi = options?.resetOrderUi ?? true
      setDetail(customer)
      if (customer) {
        const st = normalizeDetailStatus(customer.status)
        setStatusDraft(st === "inaktiv" ? "inaktiv" : "aktiv")
      }
      setOrders(nextOrders)
      setLoyalty(nextLoyalty)
      setDesigns(nextDesigns)
      setPointsDelta("")
      setPointsNote("")
      setPointsError(null)
      setEditingSection(null)
      setAddressForm(null)
      setSaveError(null)
      if (resetOrderUi) {
        setOrdersExpanded(false)
        resetOrderFilters()
      }
    },
    [resetOrderFilters]
  )

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

  const loadCustomerDetail = useCallback(
    async (kundennummer: string, options?: { force?: boolean }) => {
      const force = options?.force ?? false
      const sameCustomer = detailKundennummerRef.current === kundennummer
      const cached = detailCacheRef.current.get(kundennummer)
      if (
        !force &&
        cached &&
        Date.now() - cached.fetchedAt < DETAIL_CACHE_TTL_MS
      ) {
        detailKundennummerRef.current = cached.detail.kundennummer
        applyDetailPayload(
          cached.detail,
          cached.orders,
          cached.loyalty,
          cached.designs ?? [],
          {
            resetOrderUi: !sameCustomer,
          }
        )
        setDetailLoading(false)
        return
      }

      setDetailLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/admin/customers/${encodeURIComponent(kundennummer)}`
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
        const customer = (data.customer ?? null) as CustomerDetail | null
        const nextOrders = (data.orders ?? []) as StoredOrder[]
        const nextDesigns = (data.designs ?? []) as SavedCustomerDesign[]
        const nextLoyalty: CustomerLoyaltyInfo | null = data.loyalty
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

        detailKundennummerRef.current = customer?.kundennummer ?? null
        applyDetailPayload(customer, nextOrders, nextLoyalty, nextDesigns, {
          resetOrderUi: !sameCustomer,
        })

        if (customer) {
          detailCacheRef.current.set(kundennummer, {
            detail: customer,
            orders: nextOrders,
            loyalty: nextLoyalty,
            designs: nextDesigns,
            fetchedAt: Date.now(),
          })
        }
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
    },
    [applyDetailPayload]
  )

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    if (selectedId) {
      void loadCustomerDetail(selectedId)
    } else {
      detailKundennummerRef.current = null
      setDetail(null)
      setOrders([])
      setLoyalty(null)
      setPointsDelta("")
      setPointsNote("")
      setPointsError(null)
      setOrdersExpanded(false)
      resetOrderFilters()
      resetEditState()
    }
  }, [selectedId, loadCustomerDetail, resetEditState, resetOrderFilters])

  const selectCustomer = (kundennummer: string) => {
    setDeleteError(null)
    setPointsError(null)
    setSelectedId((prev) => (prev === kundennummer ? null : kundennummer))
  }

  const handleCustomerSort = (column: CustomerSortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => toggleSortDirection(prev))
      return
    }
    setSortColumn(column)
    setSortDirection(defaultCustomerSortDirection(column))
  }

  const handleOrderSort = (column: OrderSortColumn) => {
    if (orderSortColumn === column) {
      setOrderSortDirection((prev) => toggleSortDirection(prev))
      return
    }
    setOrderSortColumn(column)
    setOrderSortDirection(defaultOrderSortDirection(column))
  }

  const orderFiltersActive =
    orderSearch.trim() !== "" ||
    orderDateFrom !== "" ||
    orderDateTo !== "" ||
    orderAmountFrom !== "" ||
    orderAmountTo !== "" ||
    orderStatusFilter !== "all"

  const filteredOrders = useMemo(() => {
    if (!ordersExpanded) return []

    const q = orderSearch.trim().toLowerCase()
    const minAmount =
      orderAmountFrom.trim() === "" ? null : Number(orderAmountFrom)
    const maxAmount = orderAmountTo.trim() === "" ? null : Number(orderAmountTo)
    const fromTs = orderDateFrom
      ? new Date(`${orderDateFrom}T00:00:00`).getTime()
      : null
    const toTs = orderDateTo
      ? new Date(`${orderDateTo}T23:59:59.999`).getTime()
      : null

    let list = orders.filter((order) => {
      if (orderStatusFilter !== "all" && order.status !== orderStatusFilter) {
        return false
      }
      if (q) {
        const hay = `${order.orderId} ${order.status} ${statusLabel(order.status)}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      const created = new Date(order.createdAt).getTime()
      if (fromTs != null && Number.isFinite(fromTs) && created < fromTs) return false
      if (toTs != null && Number.isFinite(toTs) && created > toTs) return false
      const total = Number(order.totals?.total) || 0
      if (minAmount != null && Number.isFinite(minAmount) && total < minAmount) {
        return false
      }
      if (maxAmount != null && Number.isFinite(maxAmount) && total > maxAmount) {
        return false
      }
      return true
    })

    if (orderSortColumn) {
      list = [...list].sort((a, b) => {
        let cmp = 0
        if (orderSortColumn === "createdAt") {
          cmp = a.createdAt.localeCompare(b.createdAt)
        } else if (orderSortColumn === "total") {
          cmp = (Number(a.totals?.total) || 0) - (Number(b.totals?.total) || 0)
        } else {
          cmp = compareText(statusLabel(a.status), statusLabel(b.status))
        }
        return orderSortDirection === "asc" ? cmp : -cmp
      })
    } else {
      list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }

    return list
  }, [
    orderAmountFrom,
    orderAmountTo,
    orderDateFrom,
    orderDateTo,
    orderSearch,
    orderSortColumn,
    orderSortDirection,
    orderStatusFilter,
    orders,
    ordersExpanded,
  ])

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

  const invalidateDetailCache = (kundennummer: string) => {
    detailCacheRef.current.delete(kundennummer)
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
      invalidateDetailCache(detail.kundennummer)
      await Promise.all([
        loadCustomerDetail(detail.kundennummer, { force: true }),
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
      invalidateDetailCache(detail.kundennummer)
      await loadCustomerDetail(detail.kundennummer, { force: true })
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

      invalidateDetailCache(detail.kundennummer)
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
              {statusFilter !== "alle" || searchQuery.trim()
                ? ` von ${customers.length}`
                : ""}{" "}
              Kunde
              {filteredCustomers.length !== 1 ? "n" : ""}
              {statusFilter === "alle" && !searchQuery.trim() ? " erfasst" : ""}
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
            placeholder="Name, E-Mail, Kundennr., Ort, Tel…"
            className={cn("pl-9", adminUi.input)}
            aria-label="Kunden suchen"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <div className="ml-auto flex items-center gap-2">
            <Label className={cn("text-xs whitespace-nowrap", adminUi.label)}>
              Anzeige
            </Label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className={cn("h-8 rounded-md border px-2 text-xs", adminUi.select)}
              aria-label="Seitengrösse"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && !detail && !detailLoading && (
          <p className={adminUi.error}>{error}</p>
        )}

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
          <div className="space-y-3">
            <div className={adminUi.tableWrap}>
              <Table>
                <TableHeader>
                  <TableRow className={adminUi.tableHeadRow}>
                    <SortableHead
                      label="Kundennr."
                      active={sortColumn === "kundennummer"}
                      direction={sortDirection}
                      onClick={() => handleCustomerSort("kundennummer")}
                    />
                    <SortableHead
                      label="Name"
                      active={sortColumn === "name"}
                      direction={sortDirection}
                      onClick={() => handleCustomerSort("name")}
                    />
                    <SortableHead
                      label="Status"
                      active={sortColumn === "status"}
                      direction={sortDirection}
                      onClick={() => handleCustomerSort("status")}
                    />
                    <SortableHead
                      label="Registriert"
                      active={sortColumn === "createdAt"}
                      direction={sortDirection}
                      onClick={() => handleCustomerSort("createdAt")}
                      className="hidden md:table-cell"
                    />
                    <SortableHead
                      label="Best."
                      active={sortColumn === "orderCount"}
                      direction={sortDirection}
                      onClick={() => handleCustomerSort("orderCount")}
                      className="text-right"
                      align="right"
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleCustomers.map((customer) => {
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={cn("text-xs", adminUi.muted)}>
                {visibleCustomers.length} von {filteredCustomers.length} angezeigt
              </p>
              {hasMoreCustomers ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={adminUi.outlineBtn}
                  onClick={() =>
                    setVisibleCount((prev) =>
                      Math.min(prev + pageSize, filteredCustomers.length)
                    )
                  }
                >
                  Mehr laden
                </Button>
              ) : null}
            </div>
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
            <CustomerDetailSkeleton />
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

              <div className={cn("rounded-xl border p-4", adminUi.section)}>
                <p className={cn("text-sm font-semibold", adminUi.accentTitle)}>
                  Kundendesigns ({designs.length})
                </p>
                {designs.length === 0 ? (
                  <p className={cn("mt-2 text-sm", adminUi.muted)}>
                    Keine gespeicherten Designs.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {designs.map((design) => (
                      <li
                        key={design.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
                          adminUi.listItem
                        )}
                      >
                        <span className="min-w-0 truncate font-medium">
                          {design.label}{" "}
                          <span className={cn("text-xs", adminUi.muted)}>
                            ({design.designType})
                          </span>
                        </span>
                        <span className={cn("shrink-0 text-xs", adminUi.muted)}>
                          {formatDate(design.updatedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Collapsible open={ordersExpanded} onOpenChange={setOrdersExpanded}>
                <div className={cn("rounded-xl border", adminUi.section)}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-4 py-3 text-left",
                        adminUi.accentTitle
                      )}
                    >
                      <span className="text-sm font-semibold">
                        Bestellhistorie ({orders.length})
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform",
                          ordersExpanded && "rotate-180"
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    {ordersExpanded ? (
                      <div className="space-y-3 border-t px-4 py-3">
                        {orders.length === 0 ? (
                          <p className={cn("text-sm", adminUi.muted)}>
                            Keine Bestellungen verknuepft.
                          </p>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-end gap-2">
                                <div className="min-w-[160px] flex-1 space-y-1">
                                  <Label className={cn("text-xs", adminUi.label)}>
                                    Suche
                                  </Label>
                                  <Input
                                    value={orderSearch}
                                    onChange={(e) => setOrderSearch(e.target.value)}
                                    placeholder="Bestell-ID, Status…"
                                    className={cn("h-8 text-xs", adminUi.input)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className={cn("text-xs", adminUi.label)}>
                                    Status
                                  </Label>
                                  <select
                                    value={orderStatusFilter}
                                    onChange={(e) =>
                                      setOrderStatusFilter(e.target.value)
                                    }
                                    className={cn(
                                      "h-8 rounded-md border px-2 text-xs",
                                      adminUi.select
                                    )}
                                  >
                                    <option value="all">Alle</option>
                                    {ORDER_STATUS_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                {orderFiltersActive ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className={cn("h-8 text-xs", adminUi.muted)}
                                    onClick={resetOrderFilters}
                                  >
                                    Filter zurücksetzen
                                  </Button>
                                ) : null}
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="space-y-1">
                                  <Label className={cn("text-xs", adminUi.label)}>
                                    Datum von
                                  </Label>
                                  <Input
                                    type="date"
                                    value={orderDateFrom}
                                    onChange={(e) => setOrderDateFrom(e.target.value)}
                                    className={cn("h-8 text-xs", adminUi.input)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className={cn("text-xs", adminUi.label)}>
                                    Datum bis
                                  </Label>
                                  <Input
                                    type="date"
                                    value={orderDateTo}
                                    onChange={(e) => setOrderDateTo(e.target.value)}
                                    className={cn("h-8 text-xs", adminUi.input)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className={cn("text-xs", adminUi.label)}>
                                    Betrag von
                                  </Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.05}
                                    inputMode="decimal"
                                    value={orderAmountFrom}
                                    onChange={(e) =>
                                      setOrderAmountFrom(e.target.value)
                                    }
                                    placeholder="0.00"
                                    className={cn("h-8 text-xs", adminUi.input)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className={cn("text-xs", adminUi.label)}>
                                    Betrag bis
                                  </Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.05}
                                    inputMode="decimal"
                                    value={orderAmountTo}
                                    onChange={(e) => setOrderAmountTo(e.target.value)}
                                    placeholder="0.00"
                                    className={cn("h-8 text-xs", adminUi.input)}
                                  />
                                </div>
                              </div>
                            </div>

                            {filteredOrders.length === 0 ? (
                              <p className={cn("py-4 text-center text-sm", adminUi.muted)}>
                                Keine Bestellungen für die aktuellen Filter.
                              </p>
                            ) : (
                              <div className={adminUi.tableWrap}>
                                <Table>
                                  <TableHeader>
                                    <TableRow className={adminUi.tableHeadRow}>
                                      <TableHead className={adminUi.tableHead}>
                                        Bestell-ID
                                      </TableHead>
                                      <SortableHead
                                        label="Datum"
                                        active={orderSortColumn === "createdAt"}
                                        direction={orderSortDirection}
                                        onClick={() => handleOrderSort("createdAt")}
                                      />
                                      <SortableHead
                                        label="Betrag"
                                        active={orderSortColumn === "total"}
                                        direction={orderSortDirection}
                                        onClick={() => handleOrderSort("total")}
                                      />
                                      <SortableHead
                                        label="Status"
                                        active={orderSortColumn === "status"}
                                        direction={orderSortDirection}
                                        onClick={() => handleOrderSort("status")}
                                      />
                                      {onOpenOrder ? (
                                        <TableHead
                                          className={cn("text-right", adminUi.tableHead)}
                                        >
                                          <span className="sr-only">Aktion</span>
                                        </TableHead>
                                      ) : null}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {filteredOrders.map((order) => (
                                      <TableRow
                                        key={order.orderId}
                                        className={adminUi.tableRow}
                                      >
                                        <TableCell
                                          className={cn(
                                            "font-mono text-xs",
                                            adminUi.tableCell
                                          )}
                                        >
                                          {order.orderId}
                                        </TableCell>
                                        <TableCell
                                          className={cn("text-xs", adminUi.muted)}
                                        >
                                          {formatDate(order.createdAt)}
                                        </TableCell>
                                        <TableCell
                                          className={cn(
                                            "text-xs tabular-nums",
                                            adminUi.bodyText
                                          )}
                                        >
                                          CHF {order.totals.total.toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                          <Badge
                                            variant="outline"
                                            className={adminUi.badgeOutline}
                                          >
                                            {statusLabel(order.status)}
                                          </Badge>
                                        </TableCell>
                                        {onOpenOrder ? (
                                          <TableCell className="text-right">
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="ghost"
                                              className={cn(
                                                "h-8 hover:text-orange-300",
                                                adminUi.accentTitle
                                              )}
                                              onClick={() => onOpenOrder(order.orderId)}
                                            >
                                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                              Öffnen
                                            </Button>
                                          </TableCell>
                                        ) : null}
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : null}
                  </CollapsibleContent>
                </div>
              </Collapsible>

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
