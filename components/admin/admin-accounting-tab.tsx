"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { BookOpen, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { AccountPickerField } from "@/components/admin/account-picker-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Account, AccountKind } from "@/lib/accounting/account-types"
import type { JournalEntry, JournalLine } from "@/lib/accounting/journal-types"
import {
  sumJournalSide,
  validateJournalEntryLines,
} from "@/lib/accounting/journal-types"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type AccountingSubview = "journal" | "manual" | "accounts"

const ACCOUNT_KINDS: AccountKind[] = [
  "Gruppe",
  "Aktiv",
  "Passiv",
  "Aufwand",
  "Ertrag",
  "Komplett",
]

function formatChf(value: number): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
  }).format(value)
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium" }).format(
    new Date(iso)
  )
}

function summarizeLines(lines: JournalLine[], type: "SOLL" | "HABEN"): string {
  return lines
    .filter((line) => line.type === type)
    .map((line) => `${line.accountNumber} (${formatChf(line.amount)})`)
    .join(", ")
}

function emptyManualLine(): JournalLine {
  return {
    accountNumber: "",
    type: "SOLL",
    amount: 0,
    taxRate: 0,
  }
}

export function AdminAccountingTab() {
  const [view, setView] = useState<AccountingSubview>("journal")
  const [accounts, setAccounts] = useState<Account[]>([])
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [loadingJournal, setLoadingJournal] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [manualDate, setManualDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [manualBeleg, setManualBeleg] = useState("")
  const [manualDescription, setManualDescription] = useState("")
  const [manualLines, setManualLines] = useState<JournalLine[]>([
    { ...emptyManualLine(), type: "SOLL" },
    { ...emptyManualLine(), type: "HABEN" },
  ])

  const [newAccountNumber, setNewAccountNumber] = useState("")
  const [newAccountName, setNewAccountName] = useState("")
  const [newAccountGroup, setNewAccountGroup] = useState("")
  const [newAccountType, setNewAccountType] = useState<AccountKind>("Aktiv")

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    try {
      const res = await fetch("/api/admin/accounting/accounts", {
        cache: "no-store",
      })
      const data = (await res.json()) as { accounts?: Account[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Konten konnten nicht geladen werden.")
      setAccounts(data.accounts ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konten konnten nicht geladen werden.")
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  const loadJournal = useCallback(async () => {
    setLoadingJournal(true)
    try {
      const res = await fetch("/api/admin/accounting/journal?limit=100", {
        cache: "no-store",
      })
      const data = (await res.json()) as { entries?: JournalEntry[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Journal konnte nicht geladen werden.")
      setEntries(data.entries ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Journal konnte nicht geladen werden.")
    } finally {
      setLoadingJournal(false)
    }
  }, [])

  useEffect(() => {
    void loadAccounts()
    void loadJournal()
  }, [loadAccounts, loadJournal])

  const manualValidation = useMemo(
    () => validateJournalEntryLines(manualLines),
    [manualLines]
  )
  const manualSollTotal = sumJournalSide(manualLines, "SOLL")
  const manualHabenTotal = sumJournalSide(manualLines, "HABEN")

  const updateManualLine = (index: number, patch: Partial<JournalLine>) => {
    setManualLines((lines) =>
      lines.map((line, i) => (i === index ? { ...line, ...patch } : line))
    )
  }

  const handleManualSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (!manualValidation.valid) {
        throw new Error(manualValidation.error)
      }

      const res = await fetch("/api/admin/accounting/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: manualDate,
          belegNummer: manualBeleg.trim() || undefined,
          description: manualDescription.trim(),
          lines: manualLines,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Buchung konnte nicht gespeichert werden.")

      setManualDescription("")
      setManualBeleg("")
      setManualLines([
        { ...emptyManualLine(), type: "SOLL" },
        { ...emptyManualLine(), type: "HABEN" },
      ])
      setView("journal")
      await loadJournal()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Buchung fehlgeschlagen.")
    } finally {
      setSaving(false)
    }
  }

  const handleCreateAccount = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: newAccountNumber.trim(),
          name: newAccountName.trim(),
          group: newAccountGroup.trim() || null,
          type: newAccountType,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Konto konnte nicht erstellt werden.")

      setNewAccountNumber("")
      setNewAccountName("")
      setNewAccountGroup("")
      setNewAccountType("Aktiv")
      await loadAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konto konnte nicht erstellt werden.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={cn("text-2xl font-bold", adminUi.heading)}>
            <BookOpen className="mr-2 inline h-6 w-6 text-orange-500" />
            Buchhaltung
          </h1>
          <p className={cn("mt-1 text-sm", adminUi.muted)}>
            Journal, manuelle Buchungen und Kontenplan
          </p>
        </div>
        <div className={cn("flex flex-wrap gap-2 rounded-xl border p-2", adminUi.section)}>
          {(
            [
              ["journal", "Dashboard / Journal"],
              ["manual", "Manuelle Buchung"],
              ["accounts", "Kontenplan"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                view === id ? adminUi.navActive : adminUi.navInactive
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className={adminUi.error}>{error}</p>}

      {view === "journal" && (
        <section className={cn("space-y-4 rounded-xl border p-4 sm:p-6", adminUi.card)}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={cn("text-lg font-semibold", adminUi.heading)}>Journal</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={adminUi.outlineBtn}
              onClick={() => void loadJournal()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Aktualisieren
            </Button>
          </div>

          {loadingJournal ? (
            <p className={cn("flex items-center text-sm", adminUi.muted)}>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Journal wird geladen…
            </p>
          ) : entries.length === 0 ? (
            <p className={cn("text-sm", adminUi.muted)}>Noch keine Buchungen vorhanden.</p>
          ) : (
            <div className={adminUi.tableWrap}>
              <Table>
                <TableHeader>
                  <TableRow className={adminUi.tableHeadRow}>
                    <TableHead>Datum</TableHead>
                    <TableHead>Belegnr.</TableHead>
                    <TableHead>Text</TableHead>
                    <TableHead>Soll</TableHead>
                    <TableHead>Haben</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} className={adminUi.tableRow}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.belegNummer}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell className="max-w-[180px] text-xs">
                        {summarizeLines(entry.lines, "SOLL")}
                      </TableCell>
                      <TableCell className="max-w-[180px] text-xs">
                        {summarizeLines(entry.lines, "HABEN")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatChf(sumJournalSide(entry.lines, "SOLL"))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}

      {view === "manual" && (
        <section className={cn("space-y-4 rounded-xl border p-4 sm:p-6", adminUi.card)}>
          <h2 className={cn("text-lg font-semibold", adminUi.heading)}>Manuelle Buchung</h2>
          <form className="space-y-5" onSubmit={handleManualSubmit}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="manual-date">Datum</Label>
                <Input
                  id="manual-date"
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className={adminUi.input}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-beleg">Belegnummer (optional)</Label>
                <Input
                  id="manual-beleg"
                  value={manualBeleg}
                  onChange={(e) => setManualBeleg(e.target.value)}
                  placeholder="Automatisch, falls leer"
                  className={adminUi.input}
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="manual-description">Buchungstext</Label>
                <Input
                  id="manual-description"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  className={adminUi.input}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className={cn("text-sm font-semibold", adminUi.label)}>Buchungszeilen</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={adminUi.outlineBtn}
                  onClick={() => setManualLines((lines) => [...lines, emptyManualLine()])}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Zeile hinzufügen
                </Button>
              </div>

              {manualLines.map((line, index) => (
                <div
                  key={`line-${index}`}
                  className={cn(
                    "grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_120px_120px_120px_auto]",
                    adminUi.cardMuted
                  )}
                >
                  <div className="space-y-1">
                    <Label>Konto</Label>
                    <AccountPickerField
                      value={line.accountNumber}
                      accounts={accounts}
                      onChange={(accountNumber) =>
                        updateManualLine(index, { accountNumber })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Typ</Label>
                    <select
                      value={line.type}
                      onChange={(e) =>
                        updateManualLine(index, {
                          type: e.target.value === "HABEN" ? "HABEN" : "SOLL",
                        })
                      }
                      className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
                    >
                      <option value="SOLL">SOLL</option>
                      <option value="HABEN">HABEN</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Betrag (CHF)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.amount || ""}
                      onChange={(e) =>
                        updateManualLine(index, { amount: Number(e.target.value) })
                      }
                      className={adminUi.input}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>MwSt-Satz</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={line.taxRate || ""}
                      onChange={(e) =>
                        updateManualLine(index, { taxRate: Number(e.target.value) })
                      }
                      className={adminUi.input}
                      placeholder="0.081"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={adminUi.outlineBtn}
                      disabled={manualLines.length <= 2}
                      onClick={() =>
                        setManualLines((lines) => lines.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className={cn("rounded-lg border px-4 py-3 text-sm", adminUi.cardMuted)}>
              <p>
                Soll: <strong>{formatChf(manualSollTotal)}</strong> · Haben:{" "}
                <strong>{formatChf(manualHabenTotal)}</strong>
              </p>
              {!manualValidation.valid && (
                <p className="mt-1 text-red-500">{manualValidation.error}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={saving || !manualValidation.valid}
              className={adminUi.primaryBtn}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Speichern…
                </>
              ) : (
                "Buchung speichern"
              )}
            </Button>
          </form>
        </section>
      )}

      {view === "accounts" && (
        <section className="space-y-6">
          <div className={cn("rounded-xl border p-4 sm:p-6", adminUi.card)}>
            <h2 className={cn("mb-4 text-lg font-semibold", adminUi.heading)}>
              Konto hinzufügen
            </h2>
            <form
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={handleCreateAccount}
            >
              <div className="space-y-2">
                <Label htmlFor="account-number">Kontonummer</Label>
                <Input
                  id="account-number"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  className={adminUi.input}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-name">Name</Label>
                <Input
                  id="account-name"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className={adminUi.input}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-group">Gruppe (optional)</Label>
                <Input
                  id="account-group"
                  value={newAccountGroup}
                  onChange={(e) => setNewAccountGroup(e.target.value)}
                  className={adminUi.input}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-type">Kontoart</Label>
                <select
                  id="account-type"
                  value={newAccountType}
                  onChange={(e) => setNewAccountType(e.target.value as AccountKind)}
                  className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
                >
                  {ACCOUNT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={saving} className={adminUi.primaryBtn}>
                  <Plus className="mr-2 h-4 w-4" />
                  Konto hinzufügen
                </Button>
              </div>
            </form>
          </div>

          <div className={cn("rounded-xl border p-4 sm:p-6", adminUi.card)}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className={cn("text-lg font-semibold", adminUi.heading)}>
                Kontenplan ({accounts.length})
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={adminUi.outlineBtn}
                onClick={() => void loadAccounts()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Aktualisieren
              </Button>
            </div>

            {loadingAccounts ? (
              <p className={cn("flex items-center text-sm", adminUi.muted)}>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Konten werden geladen…
              </p>
            ) : (
              <div className={cn("max-h-[60vh] overflow-y-auto", adminUi.tableWrap)}>
                <Table>
                  <TableHeader>
                    <TableRow className={adminUi.tableHeadRow}>
                      <TableHead>Nummer</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Gruppe</TableHead>
                      <TableHead>Art</TableHead>
                      <TableHead>Systemkonto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow key={account.number} className={adminUi.tableRow}>
                        <TableCell className="font-mono text-xs">{account.number}</TableCell>
                        <TableCell>{account.name}</TableCell>
                        <TableCell>{account.group ?? "—"}</TableCell>
                        <TableCell>{account.type}</TableCell>
                        <TableCell>{account.systemCode ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
