"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeftRight, Check, Loader2, Paperclip, Plus, X } from "lucide-react"
import {
  AccountPickerField,
  type AccountPickerHandle,
} from "@/components/admin/account-picker-field"
import { TaxCodeSelectField } from "@/components/admin/tax-code-select-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Account } from "@/lib/accounting/account-types"
import type { JournalEntry } from "@/lib/accounting/journal-types"
import {
  applyTaxCodeToRow,
  defaultBookingDescription,
  emptyManualBookingRow,
  normalizeManualBookingRow,
  stripAttachmentPayload,
  toManualBookingApiRows,
  validateManualBookingRows,
  type ManualBookingAttachment,
  type ManualBookingRow,
} from "@/lib/accounting/manual-booking"
import { formatTaxCodePercent } from "@/lib/accounting/tax-code-utils"
import type { TaxCode } from "@/lib/accounting/tax-code-types"
import { formatChf } from "@/lib/admin/format-chf"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024

function formatDate(iso: string): string {
  try {
    const value = String(iso ?? "").slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "—"
    const date = new Date(`${value}T12:00:00`)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium" }).format(date)
  } catch {
    return String(iso ?? "—")
  }
}

function accountLabel(number: string, accounts: Account[]): string {
  const account = accounts.find((item) => item.number === number)
  return account ? `${account.number}\n${account.name}` : number
}

function taxCodeLabel(code: string, taxCodes: TaxCode[]): string {
  if (!code) return "—"
  const match = taxCodes.find((item) => item.code === code)
  return match ? `${match.code} (${formatTaxCodePercent(match.rate)})` : code
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."))
    reader.readAsDataURL(file)
  })
}

type ManualHistoryRow = {
  entryId: string
  date: string
  belegNummer: string
  row: ManualBookingRow
}

function flattenManualHistory(
  entries: JournalEntry[],
  taxCodes: TaxCode[]
): ManualHistoryRow[] {
  const rows: ManualHistoryRow[] = []
  for (const entry of entries) {
    try {
      if (entry.source !== "manual") continue
      if (entry.bookingRows?.length) {
        for (const row of entry.bookingRows) {
          try {
            rows.push({
              entryId: entry.id,
              date: entry.date || "",
              belegNummer: entry.belegNummer || "",
              row: normalizeManualBookingRow(row, taxCodes),
            })
          } catch (error) {
            console.error("Historie-Zeile übersprungen:", entry.id, error)
          }
        }
        continue
      }
      const soll = entry.lines?.find((line) => line.type === "SOLL")
      const haben = entry.lines?.find((line) => line.type === "HABEN")
      if (!soll || !haben) continue
      rows.push({
        entryId: entry.id,
        date: entry.date || "",
        belegNummer: entry.belegNummer || "",
        row: normalizeManualBookingRow(
          {
            debitAccountNumber: soll.accountNumber,
            creditAccountNumber: haben.accountNumber,
            description: entry.description,
            taxCode: soll.taxCode ?? "",
            taxRate: soll.taxRate,
            amount: soll.amount,
          },
          taxCodes
        ),
      })
    } catch (error) {
      console.error("Historie-Eintrag übersprungen:", entry?.id, error)
    }
  }
  return rows.slice(0, 30)
}

type AdminAccountingManualPanelProps = {
  accounts: Account[]
  taxCodes: TaxCode[]
  onBooked: () => void
}

export function AdminAccountingManualPanel({
  accounts,
  taxCodes,
  onBooked,
}: AdminAccountingManualPanelProps) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [belegNummer, setBelegNummer] = useState("")
  const [rows, setRows] = useState<ManualBookingRow[]>([emptyManualBookingRow()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<ManualHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const debitPickerRefs = useRef<Record<number, AccountPickerHandle | null>>({})
  const creditPickerRefs = useRef<Record<number, AccountPickerHandle | null>>({})

  const showSaveError = (message: string) => {
    setError(message)
    window.alert(`Fehler beim Speichern der Buchung: ${message}`)
  }

  const normalizedRows = useMemo(
    () => rows.map((row) => normalizeManualBookingRow(row, taxCodes)),
    [rows, taxCodes]
  )
  const validation = useMemo(
    () => validateManualBookingRows(normalizedRows),
    [normalizedRows]
  )

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch("/api/admin/accounting/journal?source=manual&limit=80", {
        cache: "no-store",
      })
      const data = (await res.json()) as {
        entries?: JournalEntry[]
        error?: string
        warning?: string
      }
      if (!res.ok) {
        console.error("Historie laden fehlgeschlagen:", data.error)
        setHistory([])
        setError(
          data.error
            ? `Historie: ${data.error} (Buchungsmaske bleibt nutzbar.)`
            : null
        )
        return
      }
      if (data.warning) {
        console.warn(data.warning)
      }
      setHistory(flattenManualHistory(data.entries ?? [], taxCodes))
    } catch (err) {
      console.error("Historie laden fehlgeschlagen:", err)
      setHistory([])
      // Maske bleibt bedienbar – kein harter Crash
    } finally {
      setLoadingHistory(false)
    }
  }, [taxCodes])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const updateRow = (index: number, patch: Partial<ManualBookingRow>) => {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row
        let next = { ...row, ...patch }
        if (patch.taxCode != null) {
          next = applyTaxCodeToRow(next, patch.taxCode, taxCodes)
        } else if (patch.amount != null) {
          next = normalizeManualBookingRow(next, taxCodes)
          if (next.taxCode) {
            next = applyTaxCodeToRow(next, next.taxCode, taxCodes)
          }
        } else if (
          patch.debitAccountNumber != null ||
          patch.creditAccountNumber != null
        ) {
          next = normalizeManualBookingRow(next, taxCodes)
        } else if (patch.attachment !== undefined) {
          next = normalizeManualBookingRow(next, taxCodes)
        }
        return next
      })
    )
  }

  const handleAttachment = async (index: number, file: File | null) => {
    if (!file) {
      updateRow(index, { attachment: null })
      return
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      const message = "Anhang max. 2 MB (Bild oder PDF)."
      setError(message)
      window.alert(message)
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const attachment: ManualBookingAttachment = {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
      }
      updateRow(index, { attachment })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Anhang konnte nicht gelesen werden."
      setError(message)
      window.alert(message)
    }
  }

  const handleBook = async () => {
    console.log("Speichern gestartet", rows)
    setSaving(true)
    setError(null)
    setFieldErrors({})

    try {
      // 1) Konten aus offenen Input-Feldern hard committen (verhindert Blur-Race)
      const flushedRows: ManualBookingRow[] = rows.map((row, index) => {
        const debit =
          debitPickerRefs.current[index]?.commitPending() ||
          row.debitAccountNumber
        const credit =
          creditPickerRefs.current[index]?.commitPending() ||
          row.creditAccountNumber
        return {
          ...row,
          debitAccountNumber: debit,
          creditAccountNumber: credit,
          amount: Number(row.amount) || 0,
          taxRate: Number(row.taxRate) || 0,
          taxAmount: Number(row.taxAmount) || 0,
          taxCode: row.taxCode || "",
        }
      })
      setRows(flushedRows)
      console.log("Zeilen nach Konto-Commit", flushedRows)

      // 2) Feldweise Validierung mit sichtbarem Feedback
      const nextFieldErrors: Record<string, string> = {}
      for (const [index, row] of flushedRows.entries()) {
        if (!row.debitAccountNumber.trim()) {
          nextFieldErrors[`debit-${index}`] = "Soll-Konto fehlt"
        }
        if (!row.creditAccountNumber.trim()) {
          nextFieldErrors[`credit-${index}`] = "Haben-Konto fehlt"
        }
        if (
          row.debitAccountNumber &&
          row.creditAccountNumber &&
          row.debitAccountNumber === row.creditAccountNumber
        ) {
          nextFieldErrors[`debit-${index}`] = "Soll und Haben dürfen nicht gleich sein"
          nextFieldErrors[`credit-${index}`] = "Soll und Haben dürfen nicht gleich sein"
        }
        const amount = Number(row.amount)
        if (!Number.isFinite(amount) || amount <= 0) {
          nextFieldErrors[`amount-${index}`] = "Betrag muss > 0 sein"
        }
      }

      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors)
        const firstMessage = Object.values(nextFieldErrors)[0]
        showSaveError(firstMessage)
        console.error("Validierung Feldfehler:", nextFieldErrors)
        return
      }

      const bookingDate = String(date ?? "").slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
        nextFieldErrors.date = "Datum muss YYYY-MM-DD sein"
        setFieldErrors(nextFieldErrors)
        showSaveError("Ungültiges Datumsformat (erwartet YYYY-MM-DD).")
        return
      }

      // Belegnummer ist optional – nie als Pflicht validieren
      const apiRows = toManualBookingApiRows(flushedRows, taxCodes).map(
        stripAttachmentPayload
      )
      const check = validateManualBookingRows(apiRows)
      console.log("Validierung", check, apiRows)

      if (!check.valid) {
        showSaveError(check.error ?? "Buchung ungültig.")
        console.error("Validierung fehlgeschlagen:", check)
        return
      }

      const payload = {
        date: bookingDate,
        belegNummer: belegNummer.trim() || undefined,
        description: defaultBookingDescription(apiRows),
        rows: apiRows.map((row) => ({
          debitAccountNumber: String(row.debitAccountNumber),
          creditAccountNumber: String(row.creditAccountNumber),
          description: row.description || defaultBookingDescription([row]),
          taxCode: row.taxCode || "",
          taxRate: Number(row.taxRate) || 0,
          taxAmount: Number(row.taxAmount) || 0,
          amount: Number(row.amount) || 0,
          attachment: row.attachment
            ? {
                name: row.attachment.name,
                mimeType: row.attachment.mimeType,
                size: Number(row.attachment.size) || 0,
                dataUrl: row.attachment.dataUrl || "",
              }
            : null,
        })),
      }

      console.log("API-Payload", {
        ...payload,
        rows: payload.rows.map((row) => ({
          ...row,
          attachment: row.attachment
            ? {
                ...row.attachment,
                dataUrl: row.attachment.dataUrl
                  ? `[base64 ${row.attachment.dataUrl.length} chars]`
                  : "",
              }
            : null,
        })),
      })

      const res = await fetch("/api/admin/accounting/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      let data: { error?: string; entry?: JournalEntry } = {}
      try {
        data = (await res.json()) as { error?: string; entry?: JournalEntry }
      } catch (parseError) {
        console.error(parseError)
        data = { error: `Unerwartete Server-Antwort (HTTP ${res.status}).` }
      }

      if (!res.ok) {
        console.error("Buchung Fehler:", data)
        showSaveError(data.error ?? `Buchung fehlgeschlagen (HTTP ${res.status}).`)
        return
      }

      if (!data.entry?.id) {
        showSaveError("Server hat keine gültige Buchung zurückgegeben.")
        console.error("Unerwartete Antwort:", data)
        return
      }

      console.log("Buchung gespeichert", data.entry)
      setRows([emptyManualBookingRow()])
      setBelegNummer("")
      setError(null)
      setFieldErrors({})
      await loadHistory()
      onBooked()
    } catch (error) {
      console.error(error)
      window.alert(
        "Fehler beim Speichern der Buchung: " +
          (error instanceof Error ? error.message : String(error))
      )
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className={cn("space-y-4 rounded-xl border p-4 sm:p-6", adminUi.card)}>
        <h2 className={cn("text-lg font-semibold", adminUi.heading)}>Manuelle Buchung</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={cn("text-sm font-medium", adminUi.label)}>Datum</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(
                adminUi.input,
                fieldErrors.date &&
                  "border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500"
              )}
            />
            {fieldErrors.date && (
              <p className="text-xs text-red-500">{fieldErrors.date}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className={cn("text-sm font-medium", adminUi.label)}>Belegnummer</label>
            <Input
              value={belegNummer}
              onChange={(e) => setBelegNummer(e.target.value)}
              placeholder="z. B. 89 (optional)"
              className={adminUi.input}
            />
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((row, index) => {
            const normalized = normalizedRows[index] ?? row
            const hasAttachment = Boolean(row.attachment?.dataUrl)
            return (
              <div
                key={`booking-row-${index}`}
                className={cn(
                  "flex min-w-0 flex-wrap items-end gap-3 overflow-visible rounded-lg border p-3 lg:flex-nowrap",
                  adminUi.cardMuted
                )}
              >
                <div className="min-w-[190px] flex-[1.2] basis-[190px]">
                  <label className={cn("mb-1 block text-xs", adminUi.muted)}>Soll-Konto</label>
                  <AccountPickerField
                    ref={(handle) => {
                      debitPickerRefs.current[index] = handle
                    }}
                    value={row.debitAccountNumber}
                    accounts={accounts}
                    bookableOnly
                    className="w-full"
                    invalid={Boolean(fieldErrors[`debit-${index}`])}
                    onChange={(value) => {
                      const account = accounts.find((item) => item.number === value)
                      const patch: Partial<ManualBookingRow> = { debitAccountNumber: value }
                      if (account?.defaultTaxCode && !row.taxCode) {
                        patch.taxCode = account.defaultTaxCode
                      }
                      updateRow(index, patch)
                      setFieldErrors((current) => {
                        const next = { ...current }
                        delete next[`debit-${index}`]
                        return next
                      })
                    }}
                  />
                  {fieldErrors[`debit-${index}`] && (
                    <p className="text-xs text-red-500">{fieldErrors[`debit-${index}`]}</p>
                  )}
                </div>
                <div className="hidden shrink-0 items-center justify-center self-center pb-6 lg:flex">
                  <ArrowLeftRight className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="min-w-[190px] flex-[1.2] basis-[190px]">
                  <label className={cn("mb-1 block text-xs", adminUi.muted)}>Haben-Konto</label>
                  <AccountPickerField
                    ref={(handle) => {
                      creditPickerRefs.current[index] = handle
                    }}
                    value={row.creditAccountNumber}
                    accounts={accounts}
                    bookableOnly
                    className="w-full"
                    invalid={Boolean(fieldErrors[`credit-${index}`])}
                    onChange={(value) => {
                      updateRow(index, { creditAccountNumber: value })
                      setFieldErrors((current) => {
                        const next = { ...current }
                        delete next[`credit-${index}`]
                        return next
                      })
                    }}
                  />
                  {fieldErrors[`credit-${index}`] && (
                    <p className="text-xs text-red-500">{fieldErrors[`credit-${index}`]}</p>
                  )}
                </div>
                <div className="min-w-[240px] flex-[2] basis-[240px]">
                  <label className={cn("mb-1 block text-xs", adminUi.muted)}>Beschreibung</label>
                  <Input
                    value={row.description}
                    onChange={(e) => updateRow(index, { description: e.target.value })}
                    className={adminUi.input}
                    placeholder="Buchungstext (optional)"
                  />
                </div>
                <div className="min-w-[280px] flex-[1.5] basis-[280px]">
                  <label className={cn("mb-1 block text-xs", adminUi.muted)}>MWST-Code</label>
                  <TaxCodeSelectField
                    value={row.taxCode}
                    taxCodes={taxCodes}
                    onChange={(code) => updateRow(index, { taxCode: code })}
                  />
                </div>
                <div className="w-20 shrink-0">
                  <label className={cn("mb-1 block text-xs", adminUi.muted)}>MWST</label>
                  <Input
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={normalized.taxAmount.toFixed(2)}
                    className={cn(
                      adminUi.input,
                      "h-10 bg-zinc-50 px-2 text-center text-xs text-zinc-500 dark:bg-zinc-900"
                    )}
                  />
                </div>
                <div className="w-28 shrink-0">
                  <label className={cn("mb-1 block text-xs", adminUi.muted)}>Betrag</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={row.amount || ""}
                    onChange={(e) => {
                      updateRow(index, { amount: Number(e.target.value) })
                      setFieldErrors((current) => {
                        const next = { ...current }
                        delete next[`amount-${index}`]
                        return next
                      })
                    }}
                    className={cn(
                      adminUi.input,
                      fieldErrors[`amount-${index}`] &&
                        "border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500"
                    )}
                  />
                  {fieldErrors[`amount-${index}`] && (
                    <p className="text-xs text-red-500">{fieldErrors[`amount-${index}`]}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-end self-center pb-2">
                  <input
                    ref={(el) => {
                      fileInputRefs.current[index] = el
                    }}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      void handleAttachment(index, file)
                      e.target.value = ""
                    }}
                  />
                  <button
                    type="button"
                    title={
                      hasAttachment
                        ? `Anhang: ${row.attachment?.name}`
                        : "Beleg anhängen (Bild/PDF)"
                    }
                    className={cn(
                      "relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border transition-colors",
                      hasAttachment
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600"
                        : "border-zinc-200 text-zinc-400 hover:bg-zinc-50 dark:border-zinc-700"
                    )}
                    onClick={() => fileInputRefs.current[index]?.click()}
                  >
                    <Paperclip className="h-4 w-4" />
                    {hasAttachment && (
                      <Check className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-emerald-500 p-0.5 text-white" />
                    )}
                  </button>
                </div>
                <div className="flex shrink-0 items-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={adminUi.outlineBtn}
                    disabled={rows.length <= 1}
                    onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {error && <p className={adminUi.error}>{error}</p>}
        {!validation.valid && !error && (
          <p className="text-sm text-amber-600 dark:text-amber-400">{validation.error}</p>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={adminUi.footerBtn}
            onClick={() => setRows((current) => [...current, emptyManualBookingRow()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Neue Zeile
          </Button>
          <Button
            type="button"
            disabled={saving}
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => void handleBook()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buchen…
              </>
            ) : (
              "Buchen"
            )}
          </Button>
        </div>
      </div>

      <div className={cn("rounded-xl border p-4 sm:p-6", adminUi.card)}>
        <h3 className={cn("mb-4 text-base font-semibold", adminUi.heading)}>
          Letzte manuelle Buchungen
        </h3>
        {loadingHistory ? (
          <p className={cn("flex items-center text-sm", adminUi.muted)}>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Buchungen werden geladen…
          </p>
        ) : history.length === 0 ? (
          <p className={cn("text-sm", adminUi.muted)}>Noch keine manuellen Buchungen.</p>
        ) : (
          <div className={adminUi.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow className={adminUi.tableHeadRow}>
                  <TableHead>Datum</TableHead>
                  <TableHead>Belegnummer</TableHead>
                  <TableHead>Soll</TableHead>
                  <TableHead>Haben</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>MWST</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item, index) => (
                  <TableRow key={`${item.entryId}-${index}`} className={adminUi.tableRow}>
                    <TableCell>{formatDate(item.date)}</TableCell>
                    <TableCell className="font-mono text-xs">{item.belegNummer}</TableCell>
                    <TableCell className="whitespace-pre-line text-xs">
                      {accountLabel(item.row.debitAccountNumber, accounts)}
                    </TableCell>
                    <TableCell className="whitespace-pre-line text-xs">
                      {accountLabel(item.row.creditAccountNumber, accounts)}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        {item.row.description}
                        {item.row.attachment && (
                          <Paperclip className="h-3 w-3 text-emerald-600" aria-label="Mit Anhang" />
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {taxCodeLabel(item.row.taxCode, taxCodes)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatChf(item.row.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </section>
  )
}
