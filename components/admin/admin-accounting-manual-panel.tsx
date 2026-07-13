"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, Loader2, Paperclip, Plus, X } from "lucide-react"
import { AccountPickerField } from "@/components/admin/account-picker-field"
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
  emptyManualBookingRow,
  normalizeManualBookingRow,
  validateManualBookingRows,
  type ManualBookingRow,
} from "@/lib/accounting/manual-booking"
import { formatTaxCodePercent } from "@/lib/accounting/tax-code-utils"
import type { TaxCode } from "@/lib/accounting/tax-code-types"
import { formatChf } from "@/lib/admin/format-chf"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium" }).format(
    new Date(iso)
  )
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
    if (entry.source !== "manual") continue
    if (entry.bookingRows?.length) {
      for (const row of entry.bookingRows) {
        rows.push({
          entryId: entry.id,
          date: entry.date,
          belegNummer: entry.belegNummer,
          row: normalizeManualBookingRow(row, taxCodes),
        })
      }
      continue
    }
    const soll = entry.lines.find((line) => line.type === "SOLL")
    const haben = entry.lines.find((line) => line.type === "HABEN")
    if (!soll || !haben) continue
    rows.push({
      entryId: entry.id,
      date: entry.date,
      belegNummer: entry.belegNummer,
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
  const [history, setHistory] = useState<ManualHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

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
      const data = (await res.json()) as { entries?: JournalEntry[] }
      setHistory(flattenManualHistory(data.entries ?? [], taxCodes))
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
        }
        return next
      })
    )
  }

  const handleBook = async () => {
    setSaving(true)
    setError(null)
    try {
      if (!validation.valid) throw new Error(validation.error)
      const res = await fetch("/api/admin/accounting/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          belegNummer: belegNummer.trim() || undefined,
          rows: normalizedRows,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Buchung fehlgeschlagen.")
      setRows([emptyManualBookingRow()])
      setBelegNummer("")
      await loadHistory()
      onBooked()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Buchung fehlgeschlagen.")
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
              className={adminUi.input}
            />
          </div>
          <div className="space-y-1">
            <label className={cn("text-sm font-medium", adminUi.label)}>Belegnummer</label>
            <Input
              value={belegNummer}
              onChange={(e) => setBelegNummer(e.target.value)}
              placeholder="z. B. 89"
              className={adminUi.input}
            />
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((row, index) => {
            const normalized = normalizedRows[index] ?? row
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
                    value={row.debitAccountNumber}
                    accounts={accounts}
                    bookableOnly
                    className="w-full"
                    onChange={(value) => {
                      const account = accounts.find((item) => item.number === value)
                      const patch: Partial<ManualBookingRow> = { debitAccountNumber: value }
                      if (account?.defaultTaxCode && !row.taxCode) {
                        patch.taxCode = account.defaultTaxCode
                      }
                      updateRow(index, patch)
                    }}
                  />
                </div>
                <div className="hidden shrink-0 items-center justify-center self-center pb-6 lg:flex">
                  <ArrowLeftRight className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="min-w-[190px] flex-[1.2] basis-[190px]">
                  <label className={cn("mb-1 block text-xs", adminUi.muted)}>Haben-Konto</label>
                  <AccountPickerField
                    value={row.creditAccountNumber}
                    accounts={accounts}
                    bookableOnly
                    className="w-full"
                    onChange={(value) => updateRow(index, { creditAccountNumber: value })}
                  />
                </div>
                <div className="min-w-[240px] flex-[2] basis-[240px]">
                  <label className={cn("mb-1 block text-xs", adminUi.muted)}>Beschreibung</label>
                  <Input
                    value={row.description}
                    onChange={(e) => updateRow(index, { description: e.target.value })}
                    className={adminUi.input}
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
                    onChange={(e) => updateRow(index, { amount: Number(e.target.value) })}
                    className={adminUi.input}
                  />
                </div>
                <div className="flex shrink-0 items-end self-center pb-2">
                  <Paperclip className="h-4 w-4 text-zinc-400" aria-hidden />
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
        {!validation.valid && (
          <p className="text-sm text-red-500">{validation.error}</p>
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
            disabled={saving || !validation.valid}
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
                    <TableCell>{item.row.description}</TableCell>
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
