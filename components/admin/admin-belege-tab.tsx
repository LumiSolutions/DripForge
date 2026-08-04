"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from "react"
import {
  Download,
  FilePlus2,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"
import {
  BELEG_TYPE_LABELS,
  BELEG_UNIT_OPTIONS,
  DEFAULT_BELEG_UNIT,
  OFFERTE_STATUS_LABELS,
  belegStatusLabel,
  canConvertOfferteToRechnung,
  clampDiscountPercent,
  computeBelegTotals,
  computePositionDiscountAmount,
  computePositionGross,
  computePositionLineTotal,
  emptyBelegAddress,
  normalizeBelegPosition,
  statusesForType,
  type Beleg,
  type BelegAddress,
  type BelegEmailAttachment,
  type BelegPosition,
  type BelegStatus,
  type BelegType,
  type OfferteStatus,
} from "@/lib/documents/beleg-types"
import type {
  CustomerOffer,
  CustomerOfferAttachment,
  CustomerOfferStatus,
} from "@/lib/konto/customer-offer-types"
import { formatBelegDisplayId } from "@/lib/documents/beleg-number"
import {
  defaultBelegRevenueAccountCode,
  filterRevenueAccounts,
  formatRevenueAccountLabel,
  resolveBelegAccountCode,
} from "@/lib/documents/beleg-accounts"
import {
  BELEG_VAT_OPTIONS,
  DEFAULT_BELEG_VAT,
  findBelegVatOptionByCode,
  resolveBelegVatFields,
} from "@/lib/documents/beleg-vat"
import type { Account } from "@/lib/accounting/account-types"
import {
  BelegCustomerPicker,
  customerListItemToBelegAddress,
} from "@/components/admin/beleg-customer-picker"

/** Einzeilig startend, wächst mit dem Inhalt (kein seitliches Scrollen). */
function AutoResizeTextarea({
  value,
  onChange,
  className,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows">) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useLayoutEffect(() => {
    resize()
  }, [value, resize])

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e)
    // Sofort nach Tasteneingabe nachziehen (vor dem nächsten Paint)
    requestAnimationFrame(resize)
  }

  return (
    <textarea
      {...props}
      ref={ref}
      rows={1}
      value={value}
      onChange={handleChange}
      className={cn(
        "border-input placeholder:text-muted-foreground dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-ring/50",
        "flex min-h-9 w-full resize-none overflow-hidden rounded-md border bg-transparent",
        "px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow]",
        "focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
    />
  )
}

type EditorState = {
  mode: "create" | "edit"
  type: BelegType
  id?: string
  status: BelegStatus
  kunde: BelegAddress
  customerId?: string | null
  positionen: BelegPosition[]
  notes: string
  emailAttachments: BelegEmailAttachment[]
  customerResponseRemark?: string | null
  customerRespondedAt?: string | null
  actionToken?: string | null
}

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
const ATTACHMENT_ACCEPT =
  "image/*,.stl,.pdf,application/pdf,model/stl,application/sla"

function statusOptionLabel(type: BelegType, status: BelegStatus): string {
  return belegStatusLabel(type, status)
}

function customerOfferStatusLabel(status: CustomerOffer["status"]): string {
  if (status === "active") return "Entwurf / Angebot"
  if (status === "accepted") return "Angenommen"
  if (status === "expired") return "Abgelaufen"
  if (status === "withdrawn") return "Zurückgezogen"
  return status
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."))
    reader.readAsDataURL(file)
  })
}

function formatChf(value: number): string {
  return `CHF ${value.toFixed(2)}`
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

function emptyEditor(type: BelegType = "offerte"): EditorState {
  return {
    mode: "create",
    type,
    status: statusesForType(type)[0],
    kunde: emptyBelegAddress(),
    customerId: null,
    positionen: [
      normalizeBelegPosition(
        {
          name: "",
          quantity: 1,
          unit: DEFAULT_BELEG_UNIT,
          unitPrice: 0,
          accountCode: defaultBelegRevenueAccountCode(),
          discountPercent: 0,
          taxCode: DEFAULT_BELEG_VAT.taxCode,
          taxRate: DEFAULT_BELEG_VAT.taxRate,
          taxRatePercent: DEFAULT_BELEG_VAT.taxRatePercent,
        },
        0
      ),
    ],
    notes: "",
    emailAttachments: [],
    customerResponseRemark: null,
    customerRespondedAt: null,
    actionToken: null,
  }
}

export function AdminBelegeTab() {
  const [activeType, setActiveType] = useState<BelegType>("offerte")
  const [belege, setBelege] = useState<Beleg[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [amountFrom, setAmountFrom] = useState("")
  const [amountTo, setAmountTo] = useState("")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editor, setEditor] = useState<EditorState>(emptyEditor("offerte"))
  const [revenueAccounts, setRevenueAccounts] = useState<Account[]>([])
  const [customerOffers, setCustomerOffers] = useState<CustomerOffer[]>([])
  const [customerOffersLoading, setCustomerOffersLoading] = useState(false)
  const [offerEditorOpen, setOfferEditorOpen] = useState(false)
  const [offerEditorSaving, setOfferEditorSaving] = useState(false)
  const [offerEditor, setOfferEditor] = useState<{
    id: string
    title: string
    description: string
    priceChf: string
    status: CustomerOfferStatus
    previewUrl: string
    attachments: CustomerOfferAttachment[]
    customerEmail: string
  } | null>(null)
  const [offerAttachmentUploading, setOfferAttachmentUploading] = useState(false)
  const offerAttachmentInputRef = useRef<HTMLInputElement>(null)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const loadBelege = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/belege", {
        credentials: "include",
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setBelege(Array.isArray(data.belege) ? data.belege : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Belege konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCustomerOffers = useCallback(async () => {
    setCustomerOffersLoading(true)
    try {
      const res = await fetch("/api/admin/customer-offers", {
        credentials: "include",
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Angebote fehlgeschlagen")
      setCustomerOffers(Array.isArray(data.offers) ? data.offers : [])
    } catch {
      setCustomerOffers([])
    } finally {
      setCustomerOffersLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBelege()
  }, [loadBelege])

  useEffect(() => {
    if (activeType === "offerte") {
      void loadCustomerOffers()
    }
  }, [activeType, loadCustomerOffers])

  useEffect(() => {
    if (!editorOpen) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/accounting/accounts", {
          credentials: "include",
          cache: "no-store",
        })
        const data = await res.json()
        if (!res.ok || cancelled) return
        const accounts = filterRevenueAccounts(
          Array.isArray(data.accounts) ? data.accounts : []
        )
        setRevenueAccounts(accounts)
      } catch {
        if (!cancelled) setRevenueAccounts([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editorOpen])

  const filtersActive =
    query.trim() !== "" ||
    statusFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    amountFrom !== "" ||
    amountTo !== ""

  const resetFilters = () => {
    setQuery("")
    setStatusFilter("all")
    setDateFrom("")
    setDateTo("")
    setAmountFrom("")
    setAmountTo("")
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const minAmount = amountFrom.trim() === "" ? null : Number(amountFrom)
    const maxAmount = amountTo.trim() === "" ? null : Number(amountTo)
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null

    return belege
      .filter((b) => b.type === activeType)
      .filter((b) => (statusFilter === "all" ? true : b.status === statusFilter))
      .filter((b) => {
        if (fromTs == null && toTs == null) return true
        const created = new Date(b.createdAt).getTime()
        if (Number.isNaN(created)) return false
        if (fromTs != null && created < fromTs) return false
        if (toTs != null && created > toTs) return false
        return true
      })
      .filter((b) => {
        if (minAmount == null && maxAmount == null) return true
        if (minAmount != null && !Number.isNaN(minAmount) && b.total < minAmount) {
          return false
        }
        if (maxAmount != null && !Number.isNaN(maxAmount) && b.total > maxAmount) {
          return false
        }
        return true
      })
      .filter((b) => {
        if (!q) return true
        const hay = [
          b.id,
          formatBelegDisplayId(b.id),
          b.status,
          b.kunde.firstName,
          b.kunde.lastName,
          b.kunde.email,
          b.linkedTo ?? "",
          b.linkedTo ? formatBelegDisplayId(b.linkedTo) : "",
          b.sourceOrderId ?? "",
        ]
          .join(" ")
          .toLowerCase()
        return hay.includes(q)
      })
  }, [
    activeType,
    amountFrom,
    amountTo,
    belege,
    dateFrom,
    dateTo,
    query,
    statusFilter,
  ])

  const openCreate = () => {
    setEditor(emptyEditor(activeType === "lieferschein" ? "offerte" : activeType))
    setEditorOpen(true)
  }

  const openCustomerOfferEditor = (offer: CustomerOffer) => {
    setOfferEditor({
      id: offer.id,
      title: offer.title,
      description: offer.description ?? "",
      priceChf:
        offer.priceChf != null && Number.isFinite(Number(offer.priceChf))
          ? String(offer.priceChf)
          : String(offer.cartItem.price ?? ""),
      status: offer.status,
      previewUrl: offer.previewUrl ?? "",
      attachments: Array.isArray(offer.attachments) ? [...offer.attachments] : [],
      customerEmail: offer.customerEmail,
    })
    setOfferEditorOpen(true)
  }

  const adoptOfferAsBeleg = (offer: CustomerOffer) => {
    const price = Number(offer.priceChf ?? offer.cartItem.price ?? 0)
    setEditor({
      ...emptyEditor("offerte"),
      mode: "create",
      type: "offerte",
      status: "entwurf",
      customerId: offer.customerId ?? null,
      kunde: {
        ...emptyBelegAddress(),
        email: offer.customerEmail,
      },
      positionen: [
        normalizeBelegPosition(
          {
            name: offer.title,
            quantity: Math.max(1, Number(offer.cartItem.quantity) || 1),
            unit: DEFAULT_BELEG_UNIT,
            unitPrice: Number.isFinite(price) ? price : 0,
            accountCode: defaultBelegRevenueAccountCode(),
            discountPercent: 0,
            taxCode: DEFAULT_BELEG_VAT.taxCode,
            taxRate: DEFAULT_BELEG_VAT.taxRate,
            taxRatePercent: DEFAULT_BELEG_VAT.taxRatePercent,
            details: offer.description ?? "",
          },
          0
        ),
      ],
      notes: offer.description
        ? `Übernommen aus Kunden-Angebot: ${offer.title}\n${offer.description}`
        : `Übernommen aus Kunden-Angebot: ${offer.title}`,
      emailAttachments: (offer.attachments ?? []).map((att) => ({
        id: att.id,
        fileName: att.fileName,
        mimeType: att.mimeType,
        url: att.url,
        sizeBytes: 0,
      })),
    })
    setEditorOpen(true)
  }

  const saveCustomerOfferEditor = async () => {
    if (!offerEditor) return
    setOfferEditorSaving(true)
    setError(null)
    try {
      const priceRaw = offerEditor.priceChf.trim()
      const priceChf =
        priceRaw === "" ? null : Number(priceRaw.replace(",", "."))
      if (priceRaw !== "" && !Number.isFinite(priceChf)) {
        throw new Error("Preis ist ungültig.")
      }
      const res = await fetch(
        `/api/admin/customer-offers/${encodeURIComponent(offerEditor.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: offerEditor.title.trim(),
            description: offerEditor.description,
            priceChf,
            status: offerEditor.status,
            previewUrl: offerEditor.previewUrl.trim() || null,
            attachments: offerEditor.attachments,
          }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? "Speichern fehlgeschlagen")
      }
      setOfferEditorOpen(false)
      setOfferEditor(null)
      await loadCustomerOffers()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Angebot konnte nicht gespeichert werden."
      )
    } finally {
      setOfferEditorSaving(false)
    }
  }

  const addOfferAttachments = async (files: FileList | null) => {
    if (!files?.length || !offerEditor) return
    setOfferAttachmentUploading(true)
    setError(null)
    try {
      const next: CustomerOfferAttachment[] = []
      for (const file of Array.from(files)) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          throw new Error(
            `"${file.name}" ist zu gross (max. ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB).`
          )
        }
        let url: string | null = null
        try {
          const formData = new FormData()
          formData.append("file", file)
          formData.append("productId", "customer-offer-attachments")
          const ext = file.name.includes(".")
            ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
            : ""
          formData.append(
            "category",
            [".stl", ".obj", ".glb", ".gltf", ".3mf"].includes(ext)
              ? "model"
              : "gallery"
          )
          const res = await fetch("/api/admin/upload", {
            method: "POST",
            credentials: "include",
            body: formData,
          })
          const data = await res.json().catch(() => ({}))
          if (res.ok && typeof data.url === "string" && data.url) {
            url = data.url
          }
        } catch {
          // fall through
        }
        if (!url) {
          url = await readFileAsDataUrl(file)
        }
        next.push({
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          url,
        })
      }
      setOfferEditor((prev) => {
        if (!prev) return prev
        const attachments = [...prev.attachments, ...next]
        const firstImage = next.find((a) => a.mimeType.startsWith("image/"))
        return {
          ...prev,
          attachments,
          previewUrl:
            prev.previewUrl.trim() ||
            firstImage?.url ||
            next[0]?.url ||
            prev.previewUrl,
        }
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Anhang konnte nicht hinzugefügt werden."
      )
    } finally {
      setOfferAttachmentUploading(false)
      if (offerAttachmentInputRef.current) {
        offerAttachmentInputRef.current.value = ""
      }
    }
  }

  const openEdit = (beleg: Beleg) => {
    setEditor({
      mode: "edit",
      type: beleg.type,
      id: beleg.id,
      status: beleg.status,
      kunde: beleg.kunde,
      customerId: beleg.customerId ?? null,
      positionen: beleg.positionen.length
        ? beleg.positionen.map((pos, i) => normalizeBelegPosition(pos, i))
        : emptyEditor().positionen,
      notes: beleg.notes ?? "",
      emailAttachments: Array.isArray(beleg.emailAttachments)
        ? beleg.emailAttachments
        : [],
      customerResponseRemark: beleg.customerResponseRemark ?? null,
      customerRespondedAt: beleg.customerRespondedAt ?? null,
      actionToken: beleg.actionToken ?? null,
    })
    setEditorOpen(true)
  }

  const updateKunde = <K extends keyof BelegAddress>(key: K, value: BelegAddress[K]) => {
    setEditor((prev) => ({ ...prev, kunde: { ...prev.kunde, [key]: value } }))
  }

  const updatePosition = (index: number, patch: Partial<BelegPosition>) => {
    setEditor((prev) => {
      const positionen = prev.positionen.map((pos, i) => {
        if (i !== index) return pos
        const next: BelegPosition = { ...pos, ...patch }
        // Zahlen normalisieren / Zeilensumme neu berechnen — Textfelder nicht trimmen
        // (sonst verschluckt .trim() Leerzeichen am Ende beim Tippen).
        if (
          patch.quantity !== undefined ||
          patch.unitPrice !== undefined ||
          patch.discountPercent !== undefined
        ) {
          next.quantity = Math.max(0, Number(next.quantity) || 0)
          next.unitPrice = Math.max(0, Number(next.unitPrice) || 0)
          next.discountPercent = clampDiscountPercent(next.discountPercent)
          next.lineTotal = computePositionLineTotal(
            next.quantity,
            next.unitPrice,
            next.discountPercent
          )
        }
        if (patch.accountCode !== undefined) {
          next.accountCode = resolveBelegAccountCode(
            next.accountCode,
            revenueAccounts
          )
        }
        if (
          patch.taxCode !== undefined ||
          patch.taxRate !== undefined ||
          patch.taxRatePercent !== undefined
        ) {
          const vat = resolveBelegVatFields({
            taxCode: next.taxCode,
            taxRate: next.taxRate,
            taxRatePercent: next.taxRatePercent,
          })
          next.taxCode = vat.taxCode
          next.taxRate = vat.taxRate
          next.taxRatePercent = vat.taxRatePercent
        }
        return next
      })
      return { ...prev, positionen }
    })
  }

  const setPositionVat = (index: number, taxCode: string) => {
    const vat = resolveBelegVatFields({ taxCode })
    updatePosition(index, {
      taxCode: vat.taxCode,
      taxRate: vat.taxRate,
      taxRatePercent: vat.taxRatePercent,
    })
  }

  const editorTotals = computeBelegTotals(editor.positionen)

  const addEmailAttachments = async (files: FileList | null) => {
    if (!files?.length) return
    setAttachmentUploading(true)
    setError(null)
    try {
      const next: BelegEmailAttachment[] = []
      for (const file of Array.from(files)) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          throw new Error(
            `"${file.name}" ist zu gross (max. ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB).`
          )
        }
        let url: string | null = null
        // Prefer Azure / admin upload; fall back to data URL for local/dev.
        try {
          const formData = new FormData()
          formData.append("file", file)
          formData.append("productId", "offerte-attachments")
          const ext = file.name.includes(".")
            ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
            : ""
          formData.append(
            "category",
            [".stl", ".obj", ".glb", ".gltf", ".3mf"].includes(ext)
              ? "model"
              : "gallery"
          )
          const res = await fetch("/api/admin/upload", {
            method: "POST",
            credentials: "include",
            body: formData,
          })
          const data = await res.json().catch(() => ({}))
          if (res.ok && typeof data.url === "string" && data.url) {
            url = data.url
          }
        } catch {
          // fall through to data URL
        }
        if (!url) {
          url = await readFileAsDataUrl(file)
        }
        next.push({
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          url,
          sizeBytes: file.size,
        })
      }
      setEditor((prev) => ({
        ...prev,
        emailAttachments: [...prev.emailAttachments, ...next],
      }))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Anhang konnte nicht hinzugefügt werden."
      )
    } finally {
      setAttachmentUploading(false)
      if (attachmentInputRef.current) attachmentInputRef.current.value = ""
    }
  }

  const saveEditor = async () => {
    setSaving(true)
    setError(null)
    try {
      const positionen = editor.positionen.map((pos, i) =>
        normalizeBelegPosition(pos, i)
      )
      const payload = {
        status: editor.status,
        kunde: editor.kunde,
        customerId: editor.customerId ?? null,
        positionen,
        notes: editor.notes,
        emailAttachments: editor.emailAttachments,
      }
      if (editor.mode === "create") {
        const res = await fetch("/api/admin/belege", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: editor.type,
            ...payload,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      } else if (editor.id) {
        const res = await fetch(`/api/admin/belege/${encodeURIComponent(editor.id)}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      }
      setEditorOpen(false)
      await loadBelege()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen")
    } finally {
      setSaving(false)
    }
  }

  const downloadPdf = async (beleg: Beleg) => {
    try {
      const res = await fetch(`/api/admin/belege/${encodeURIComponent(beleg.id)}/pdf`, {
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "PDF fehlgeschlagen")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${formatBelegDisplayId(beleg.id)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF-Download fehlgeschlagen")
    }
  }

  const convert = async (beleg: Beleg, targetType: BelegType) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/belege/${encodeURIComponent(beleg.id)}/convert`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Umwandlung fehlgeschlagen")
      setActiveType(targetType)
      await loadBelege()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Umwandlung fehlgeschlagen")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (beleg: Beleg) => {
    if (!window.confirm(`Beleg ${formatBelegDisplayId(beleg.id)} wirklich löschen?`)) return
    try {
      const res = await fetch(`/api/admin/belege/${encodeURIComponent(beleg.id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "Löschen fehlgeschlagen")
      await loadBelege()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen")
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Belegverwaltung</h1>
          <p className="text-sm text-muted-foreground">
            Offerten, Rechnungen und Lieferscheine inkl. Umwandlung und PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadBelege()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Offerte
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Tabs
        value={activeType}
        onValueChange={(value) => {
          setActiveType(value as BelegType)
          setStatusFilter("all")
        }}
      >
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="offerte">Offerten</TabsTrigger>
          <TabsTrigger value="rechnung">Rechnungen</TabsTrigger>
          <TabsTrigger value="lieferschein">Lieferscheine</TabsTrigger>
        </TabsList>

        {(["offerte", "rechnung", "lieferschein"] as BelegType[]).map((type) => (
          <TabsContent key={type} value={type} className="space-y-4">
            <Card className={adminUi.section}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[220px] flex-1 space-y-1">
                    <Label className={cn("text-xs", adminUi.label)}>Suche</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Suche nach Nummer, Kunde, Status…"
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
                      {statusesForType(type).map((status) => (
                        <option key={status} value={status}>
                          {statusOptionLabel(type, status)}
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

            <Card className={adminUi.section}>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Laden…
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                    Keine {BELEG_TYPE_LABELS[type]} gefunden.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nummer</TableHead>
                        <TableHead>Kunde</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Betrag</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((beleg) => (
                        <TableRow key={beleg.id}>
                          <TableCell className="font-medium">
                            <div>{formatBelegDisplayId(beleg.id)}</div>
                            {beleg.linkedTo ? (
                              <div className="text-xs text-muted-foreground">
                                → {formatBelegDisplayId(beleg.linkedTo)}
                              </div>
                            ) : null}
                            {beleg.sourceOrderId ? (
                              <div className="text-xs text-muted-foreground">
                                Bestell-Ref: {beleg.sourceOrderId}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div>
                              {beleg.kunde.firstName} {beleg.kunde.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {beleg.kunde.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                              {belegStatusLabel(beleg.type, beleg.status)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {beleg.type === "lieferschein"
                              ? "—"
                              : formatChf(beleg.total)}
                          </TableCell>
                          <TableCell>{formatDate(beleg.createdAt)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEdit(beleg)}
                              >
                                <FileText className="mr-1 h-3.5 w-3.5" />
                                Bearbeiten
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void downloadPdf(beleg)}
                              >
                                <Download className="mr-1 h-3.5 w-3.5" />
                                PDF
                              </Button>
                              {beleg.type === "offerte" ? (
                                <Button
                                  size="sm"
                                  onClick={() => void convert(beleg, "rechnung")}
                                  disabled={
                                    saving ||
                                    !canConvertOfferteToRechnung(beleg.status)
                                  }
                                  title={
                                    canConvertOfferteToRechnung(beleg.status)
                                      ? undefined
                                      : "Nur bei Verbucht / Gesendet / Angenommen"
                                  }
                                >
                                  <FilePlus2 className="mr-1 h-3.5 w-3.5" />
                                  → Rechnung
                                </Button>
                              ) : null}
                              {beleg.type === "rechnung" ? (
                                <Button
                                  size="sm"
                                  onClick={() => void convert(beleg, "lieferschein")}
                                  disabled={saving}
                                >
                                  <FilePlus2 className="mr-1 h-3.5 w-3.5" />
                                  → Lieferschein
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void remove(beleg)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {type === "offerte" ? (
              <Card className={adminUi.section}>
                <CardContent className="space-y-3 p-4">
                  <div>
                    <h2 className="text-base font-semibold">
                      Vorbereitete Angebote / Entwürfe
                    </h2>
                    <p className={cn("text-sm", adminUi.muted)}>
                      Kunden-Angebote aus der Kundenverwaltung (Warenkorb-Entwürfe).
                    </p>
                  </div>
                  {customerOffersLoading ? (
                    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Laden…
                    </div>
                  ) : customerOffers.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">
                      Keine vorbereiteten Kunden-Angebote vorhanden.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Titel</TableHead>
                          <TableHead>Kunde</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Preis</TableHead>
                          <TableHead>Aktualisiert</TableHead>
                          <TableHead className="text-right">Aktionen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerOffers.map((offer) => (
                          <TableRow key={offer.id}>
                            <TableCell className="font-medium">
                              <div>{offer.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {offer.cartItem.type}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{offer.customerEmail}</div>
                              {offer.customerId ? (
                                <div className="text-xs text-muted-foreground">
                                  {offer.customerId}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                                {customerOfferStatusLabel(offer.status)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {offer.priceChf != null
                                ? formatChf(Number(offer.priceChf))
                                : "—"}
                            </TableCell>
                            <TableCell>{formatDate(offer.updatedAt)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openCustomerOfferEditor(offer)}
                                >
                                  <Pencil className="mr-1 h-3.5 w-3.5" />
                                  Bearbeiten
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => adoptOfferAsBeleg(offer)}
                                >
                                  <FilePlus2 className="mr-1 h-3.5 w-3.5" />
                                  Als Offerte übernehmen
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] w-[min(100vw-1.5rem,68rem)] max-w-5xl overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {editor.mode === "create"
                ? `Neue ${BELEG_TYPE_LABELS[editor.type]}`
                : `${BELEG_TYPE_LABELS[editor.type]} ${editor.id}`}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            {editor.mode === "create" ? (
              <div className="space-y-2">
                <Label>Typ</Label>
                <select
                  value={editor.type}
                  onChange={(e) => {
                    const type = e.target.value as BelegType
                    setEditor((prev) => ({
                      ...prev,
                      type,
                      status: statusesForType(type)[0],
                    }))
                  }}
                  className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
                >
                  <option value="offerte">Offerte</option>
                  <option value="rechnung">Rechnung</option>
                </select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                value={editor.status}
                onChange={(e) =>
                  setEditor((prev) => ({
                    ...prev,
                    status: e.target.value as BelegStatus,
                  }))
                }
                className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
              >
                {statusesForType(editor.type).map((status) => (
                  <option key={status} value={status}>
                    {statusOptionLabel(editor.type, status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/60 p-3">
            <BelegCustomerPicker
              onSelect={(customer) => {
                setEditor((prev) => ({
                  ...prev,
                  customerId: customer.kundennummer,
                  kunde: customerListItemToBelegAddress(customer),
                }))
              }}
            />
            {editor.customerId ? (
              <p className={cn("text-xs", adminUi.muted)}>
                Verknüpft: {editor.customerId}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Vorname</Label>
              <Input
                value={editor.kunde.firstName}
                onChange={(e) => updateKunde("firstName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Nachname</Label>
              <Input
                value={editor.kunde.lastName}
                onChange={(e) => updateKunde("lastName", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={editor.kunde.email}
                onChange={(e) => updateKunde("email", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Strasse</Label>
              <Input
                value={editor.kunde.street}
                onChange={(e) => updateKunde("street", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>PLZ</Label>
              <Input
                value={editor.kunde.zip}
                onChange={(e) => updateKunde("zip", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ort</Label>
              <Input
                value={editor.kunde.city}
                onChange={(e) => updateKunde("city", e.target.value)}
              />
            </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Positionen</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setEditor((prev) => ({
                    ...prev,
                    positionen: [
                      ...prev.positionen,
                      normalizeBelegPosition(
                        {
                          name: "",
                          quantity: 1,
                          unit: DEFAULT_BELEG_UNIT,
                          unitPrice: 0,
                          accountCode: resolveBelegAccountCode(
                            defaultBelegRevenueAccountCode(),
                            revenueAccounts
                          ),
                          discountPercent: 0,
                          taxCode: DEFAULT_BELEG_VAT.taxCode,
                          taxRate: DEFAULT_BELEG_VAT.taxRate,
                          taxRatePercent: DEFAULT_BELEG_VAT.taxRatePercent,
                        },
                        prev.positionen.length
                      ),
                    ],
                  }))
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Position
              </Button>
            </div>
            {editor.positionen.map((pos, index) => {
              const vatCode =
                findBelegVatOptionByCode(pos.taxCode)?.taxCode ??
                resolveBelegVatFields(pos).taxCode
              const accountCode = resolveBelegAccountCode(
                pos.accountCode,
                revenueAccounts
              )
              const gross = computePositionGross(pos.quantity, pos.unitPrice)
              const discountAmount = computePositionDiscountAmount(
                pos.quantity,
                pos.unitPrice,
                pos.discountPercent
              )
              const accountOptions = (() => {
                const list = [...revenueAccounts]
                if (accountCode && !list.some((a) => a.number === accountCode)) {
                  list.unshift({
                    number: accountCode,
                    name: "Gespeichertes Ertragskonto",
                    group: null,
                    type: "Ertrag",
                    isEditable: true,
                    isActive: true,
                    vatBookable: true,
                    defaultVatRate: 0,
                    createdAt: "",
                    updatedAt: "",
                  })
                }
                if (list.length === 0) {
                  list.push({
                    number: defaultBelegRevenueAccountCode(),
                    name: "Standard-Ertragskonto",
                    group: null,
                    type: "Ertrag",
                    isEditable: true,
                    isActive: true,
                    vatBookable: true,
                    defaultVatRate: 0,
                    createdAt: "",
                    updatedAt: "",
                  })
                }
                return list
              })()
              return (
                <div
                  key={pos.id}
                  className="space-y-2 rounded-xl border border-border/60 p-3"
                >
                  <div className="grid items-start gap-2 lg:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Name / Freitext</Label>
                      <AutoResizeTextarea
                        value={pos.name}
                        onChange={(e) =>
                          updatePosition(index, { name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Details</Label>
                      <AutoResizeTextarea
                        value={pos.details ?? ""}
                        onChange={(e) =>
                          updatePosition(index, { details: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid items-start gap-2 sm:grid-cols-2 lg:grid-cols-12">
                    <div className="space-y-1 lg:col-span-1">
                      <Label className="text-xs">Menge</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={pos.quantity}
                        onChange={(e) =>
                          updatePosition(index, {
                            quantity: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1 lg:col-span-1">
                      <Label className="text-xs">Einheit</Label>
                      <Input
                        list={`beleg-unit-options-${pos.id}`}
                        value={pos.unit}
                        placeholder={DEFAULT_BELEG_UNIT}
                        onChange={(e) =>
                          updatePosition(index, { unit: e.target.value })
                        }
                      />
                      <datalist id={`beleg-unit-options-${pos.id}`}>
                        {BELEG_UNIT_OPTIONS.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </div>
                    <div className="space-y-1 lg:col-span-2">
                      <Label className="text-xs">Preis</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.05}
                        value={pos.unitPrice}
                        onChange={(e) =>
                          updatePosition(index, {
                            unitPrice: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1 lg:col-span-1">
                      <Label className="text-xs">Rabatt %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={pos.discountPercent}
                        onChange={(e) =>
                          updatePosition(index, {
                            discountPercent: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1 lg:col-span-2">
                      <Label className="text-xs">MwSt</Label>
                      <Select
                        value={vatCode}
                        onValueChange={(value) => setPositionVat(index, value)}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="MwSt wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {BELEG_VAT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.taxCode} value={opt.taxCode}>
                              {opt.label} · {opt.taxCode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:col-span-2 lg:col-span-4">
                      <Label className="text-xs">Konto</Label>
                      <Select
                        value={accountCode}
                        onValueChange={(value) =>
                          updatePosition(index, { accountCode: value })
                        }
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Ertragskonto wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {accountOptions.map((account) => (
                            <SelectItem key={account.number} value={account.number}>
                              {formatRevenueAccountLabel(account)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-start justify-end pt-6 lg:col-span-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-9 w-9 p-0"
                        disabled={editor.positionen.length <= 1}
                        onClick={() =>
                          setEditor((prev) => ({
                            ...prev,
                            positionen: prev.positionen.filter(
                              (_, i) => i !== index
                            ),
                          }))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        <span className="sr-only">Entfernen</span>
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Brutto {formatChf(gross)}
                    {discountAmount > 0
                      ? ` · Rabatt −${formatChf(discountAmount)} (${pos.discountPercent}%)`
                      : ""}
                    {" · "}
                    Netto {formatChf(pos.lineTotal)}
                    {pos.taxRatePercent > 0
                      ? ` · MwSt ${pos.taxRatePercent}% (${pos.taxCode}): ${formatChf(pos.lineTotal * pos.taxRate)}`
                      : ` · ${pos.taxCode}`}
                    {` · Konto ${accountCode}`}
                  </p>
                </div>
              )
            })}
            <p className="text-sm font-medium">
              Total inkl. MwSt.: {formatChf(editorTotals.total)}{" "}
              <span className="font-normal text-muted-foreground">
                (Netto {formatChf(editorTotals.subtotal)} · MwSt.{" "}
                {formatChf(editorTotals.vatTotal)})
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Notiz</Label>
            <Textarea
              rows={3}
              value={editor.notes}
              onChange={(e) => setEditor((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          {editor.type === "offerte" ? (
            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    E-Mail-Anhänge
                  </Label>
                  <p className={cn("mt-1 text-xs", adminUi.muted)}>
                    Bilder, STL oder PDF — nur als E-Mail-Anhang, nicht auf dem PDF.
                  </p>
                </div>
                <div>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    multiple
                    className="hidden"
                    onChange={(e) => void addEmailAttachments(e.target.files)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={attachmentUploading}
                    onClick={() => attachmentInputRef.current?.click()}
                  >
                    {attachmentUploading ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="mr-1 h-3.5 w-3.5" />
                    )}
                    Datei hinzufügen
                  </Button>
                </div>
              </div>
              {editor.emailAttachments.length === 0 ? (
                <p className={cn("text-sm", adminUi.muted)}>Keine Anhänge.</p>
              ) : (
                <ul className="space-y-2">
                  {editor.emailAttachments.map((att) => (
                    <li
                      key={att.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{att.fileName}</p>
                        <p className={cn("text-xs", adminUi.muted)}>
                          {att.mimeType}
                          {att.sizeBytes != null
                            ? ` · ${(att.sizeBytes / 1024).toFixed(0)} KB`
                            : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() =>
                          setEditor((prev) => ({
                            ...prev,
                            emailAttachments: prev.emailAttachments.filter(
                              (a) => a.id !== att.id
                            ),
                          }))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        <span className="sr-only">Entfernen</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {editor.type === "offerte" &&
          (editor.status === "angenommen" || editor.status === "abgelehnt") &&
          (editor.customerResponseRemark || editor.customerRespondedAt) ? (
            <div className="space-y-2 rounded-xl border border-orange-200/70 bg-orange-50/50 p-3">
              <Label>
                Kundenantwort (
                {OFFERTE_STATUS_LABELS[editor.status as OfferteStatus] ??
                  editor.status}
                )
              </Label>
              {editor.customerRespondedAt ? (
                <p className={cn("text-xs", adminUi.muted)}>
                  {formatDate(editor.customerRespondedAt)}
                </p>
              ) : null}
              <p className="whitespace-pre-wrap text-sm">
                {editor.customerResponseRemark?.trim()
                  ? editor.customerResponseRemark
                  : "Keine Bemerkung hinterlassen."}
              </p>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => void saveEditor()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={offerEditorOpen}
        onOpenChange={(open) => {
          setOfferEditorOpen(open)
          if (!open) setOfferEditor(null)
        }}
      >
        <DialogContent className="max-h-[90vh] w-[min(100vw-1.5rem,36rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Kunden-Angebot bearbeiten</DialogTitle>
          </DialogHeader>
          {offerEditor ? (
            <div className="space-y-4">
              <p className={cn("text-xs", adminUi.muted)}>
                Kunde: {offerEditor.customerEmail}
              </p>
              <div className="space-y-2">
                <Label htmlFor="offer-title">Titel</Label>
                <Input
                  id="offer-title"
                  value={offerEditor.title}
                  onChange={(e) =>
                    setOfferEditor((prev) =>
                      prev ? { ...prev, title: e.target.value } : prev
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-description">Beschreibung</Label>
                <Textarea
                  id="offer-description"
                  rows={3}
                  value={offerEditor.description}
                  onChange={(e) =>
                    setOfferEditor((prev) =>
                      prev ? { ...prev, description: e.target.value } : prev
                    )
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="offer-price">Preis (CHF)</Label>
                  <Input
                    id="offer-price"
                    inputMode="decimal"
                    value={offerEditor.priceChf}
                    onChange={(e) =>
                      setOfferEditor((prev) =>
                        prev ? { ...prev, priceChf: e.target.value } : prev
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offer-status">Status</Label>
                  <select
                    id="offer-status"
                    value={offerEditor.status}
                    onChange={(e) =>
                      setOfferEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              status: e.target.value as CustomerOfferStatus,
                            }
                          : prev
                      )
                    }
                    className={cn(
                      "h-10 w-full rounded-md border px-3 text-sm",
                      adminUi.select
                    )}
                  >
                    <option value="active">Entwurf / Angebot</option>
                    <option value="accepted">Angenommen</option>
                    <option value="expired">Abgelaufen</option>
                    <option value="withdrawn">Zurückgezogen</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-preview">Vorschau-URL</Label>
                <Input
                  id="offer-preview"
                  value={offerEditor.previewUrl}
                  placeholder="https://… oder data:…"
                  onChange={(e) =>
                    setOfferEditor((prev) =>
                      prev ? { ...prev, previewUrl: e.target.value } : prev
                    )
                  }
                />
                {offerEditor.previewUrl ? (
                  <div className="relative mt-1 h-28 w-full overflow-hidden rounded-lg border bg-secondary/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={offerEditor.previewUrl}
                      alt=""
                      className="h-full w-full object-contain p-2"
                    />
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Anhänge</Label>
                <input
                  ref={offerAttachmentInputRef}
                  type="file"
                  multiple
                  accept={ATTACHMENT_ACCEPT}
                  className="hidden"
                  onChange={(e) => void addOfferAttachments(e.target.files)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={offerAttachmentUploading}
                  onClick={() => offerAttachmentInputRef.current?.click()}
                >
                  {offerAttachmentUploading ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="mr-1 h-3.5 w-3.5" />
                  )}
                  Datei hochladen
                </Button>
                {offerEditor.attachments.length > 0 ? (
                  <ul className="space-y-1.5 text-sm">
                    {offerEditor.attachments.map((att) => (
                      <li
                        key={att.id}
                        className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                      >
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 truncate text-primary hover:underline"
                        >
                          <Paperclip className="mr-1 inline h-3.5 w-3.5" />
                          {att.fileName}
                        </a>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 px-0"
                          onClick={() =>
                            setOfferEditor((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    attachments: prev.attachments.filter(
                                      (a) => a.id !== att.id
                                    ),
                                  }
                                : prev
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={cn("text-xs", adminUi.muted)}>
                    Keine Anhänge.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOfferEditorOpen(false)
                    setOfferEditor(null)
                  }}
                >
                  Abbrechen
                </Button>
                <Button
                  type="button"
                  disabled={offerEditorSaving}
                  onClick={() => void saveCustomerOfferEditor()}
                >
                  {offerEditorSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Speichern
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
