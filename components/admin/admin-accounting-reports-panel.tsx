"use client"

import { useCallback, useEffect, useMemo, useState, Fragment } from "react"
import {
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react"
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
import { confirmJournalEntryDeletion } from "@/lib/accounting/confirm-journal-delete"
import { downloadCsv } from "@/lib/accounting/export-csv"
import {
  emptyBalanceSheetLayout,
  emptyIncomeStatementLayout,
  matchesSearchQuery,
  type BalanceSheetLine,
  type IncomeStatementLine,
  type JournalReportRow,
  type LedgerRow,
  type ReportAccountDetail,
} from "@/lib/accounting/reports"
import { formatChf } from "@/lib/admin/format-chf"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type ReportSubview = "kontenblatt" | "journal" | "erfolgsrechnung" | "bilanz"

type ReportsPayload = {
  from: string
  to: string
  ledger: LedgerRow[]
  journal: JournalReportRow[]
  incomeStatement: IncomeStatementLine[]
  balanceSheet: BalanceSheetLine[]
  accounts: Account[]
}

function emptyReportsPayload(from: string, to: string): ReportsPayload {
  return {
    from,
    to,
    ledger: [],
    journal: [],
    incomeStatement: emptyIncomeStatementLayout(),
    balanceSheet: emptyBalanceSheetLayout(),
    accounts: [],
  }
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium" }).format(
    new Date(iso)
  )
}

function ExportButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={adminUi.outlineBtn}
      disabled={disabled}
      onClick={onClick}
    >
      <Download className="mr-2 h-4 w-4" />
      Excel exportieren
    </Button>
  )
}

function AccountDetailRows({
  accounts,
  indentClass,
}: {
  accounts: ReportAccountDetail[]
  indentClass: string
}) {
  if (!accounts.length) {
    return (
      <TableRow className={adminUi.tableRow}>
        <TableCell colSpan={2} className={cn("text-xs", indentClass, adminUi.muted)}>
          Keine Einzelkonten in dieser Gruppe.
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      {accounts.map((account) => (
        <TableRow key={account.number} className={cn(adminUi.tableRow, "bg-zinc-50/60 dark:bg-zinc-900/40")}>
          <TableCell className={cn("py-1.5 text-xs", indentClass)}>
            <span className="font-mono text-zinc-500">{account.number}</span>{" "}
            {account.name}
          </TableCell>
          <TableCell
            className={cn(
              "py-1.5 text-right text-xs font-medium",
              account.amount > 0
                ? "text-emerald-600"
                : account.amount < 0
                  ? "text-red-600"
                  : undefined
            )}
          >
            {formatChf(account.amount)}
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

export function AdminAccountingReportsPanel({
  onEditEntry,
}: {
  onEditEntry?: (entryId: string) => void
}) {
  const year = new Date().getFullYear()
  const [view, setView] = useState<ReportSubview>("kontenblatt")
  const [from, setFrom] = useState(`${year}-01-01`)
  const [to, setTo] = useState(`${year}-12-31`)
  const [account, setAccount] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [data, setData] = useState<ReportsPayload>(() =>
    emptyReportsPayload(`${year}-01-01`, `${year}-12-31`)
  )
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleExpanded = (id: string) => {
    setExpanded((current) => ({ ...current, [id]: !current[id] }))
  }

  const loadReports = useCallback(async () => {
    setLoading(true)
    const fallback = emptyReportsPayload(from, to)
    try {
      const params = new URLSearchParams({ from, to })
      if (account) params.set("account", account)
      const res = await fetch(`/api/admin/accounting/reports?${params}`, {
        cache: "no-store",
      })
      const payload = (await res.json()) as ReportsPayload & { error?: string }
      if (!res.ok) {
        setData(fallback)
        return
      }
      setData({
        from: payload.from ?? from,
        to: payload.to ?? to,
        ledger: Array.isArray(payload.ledger) ? payload.ledger : [],
        journal: Array.isArray(payload.journal) ? payload.journal : [],
        incomeStatement:
          Array.isArray(payload.incomeStatement) && payload.incomeStatement.length > 0
            ? payload.incomeStatement
            : emptyIncomeStatementLayout(),
        balanceSheet:
          Array.isArray(payload.balanceSheet) && payload.balanceSheet.length > 0
            ? payload.balanceSheet
            : emptyBalanceSheetLayout(),
        accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
      })
    } catch {
      setData(fallback)
    } finally {
      setLoading(false)
    }
  }, [from, to, account])

  const handleDeleteEntry = async (entryId: string, belegNummer: string) => {
    if (!confirmJournalEntryDeletion(belegNummer)) return

    setDeletingId(entryId)
    setSuccess(null)
    setActionError(null)
    try {
      const res = await fetch(
        `/api/admin/accounting/journal/${encodeURIComponent(entryId)}`,
        { method: "DELETE" }
      )
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(payload.error ?? "Buchung konnte nicht gelöscht werden.")
      }
      setSuccess("Buchung erfolgreich gelöscht")
      await loadReports()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Buchung konnte nicht gelöscht werden."
      setActionError(message)
      window.alert(message)
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const ledgerRows = useMemo(
    () =>
      data.ledger.filter((row) =>
        matchesSearchQuery(search, [
          row.description,
          row.gegenkonto,
          row.belegNummer,
          row.soll,
          row.haben,
          row.saldo,
        ])
      ),
    [data.ledger, search]
  )

  const journalRows = useMemo(
    () =>
      data.journal.filter((row) =>
        matchesSearchQuery(search, [
          row.belegNummer,
          row.date,
          row.sollKonto,
          row.habenKonto,
          row.description,
          row.taxCode,
          row.amount,
        ])
      ),
    [data.journal, search]
  )

  const incomeStatement =
    data.incomeStatement.length > 0
      ? data.incomeStatement
      : emptyIncomeStatementLayout()
  const balanceSheet =
    data.balanceSheet.length > 0 ? data.balanceSheet : emptyBalanceSheetLayout()

  const exportLedger = () => {
    downloadCsv(
      `kontenblatt-${from}-${to}.csv`,
      ["Datum", "Beleg-Nr", "Buchungstext", "Gegenkonto", "Soll (+)", "Haben (-)", "Saldo"],
      ledgerRows.map((row) => [
        row.date,
        row.belegNummer,
        row.description,
        row.gegenkonto,
        row.soll || "",
        row.haben || "",
        row.saldo,
      ])
    )
  }

  const exportJournal = () => {
    downloadCsv(
      `journal-${from}-${to}.csv`,
      ["Beleg-Nr", "Datum", "Soll-Konto", "Haben-Konto", "Beschreibung", "MWST-Code", "Betrag"],
      journalRows.map((row) => [
        row.belegNummer,
        row.date,
        row.sollKonto,
        row.habenKonto,
        row.description,
        row.taxCode,
        row.amount,
      ])
    )
  }

  const exportIncome = () => {
    downloadCsv(
      `erfolgsrechnung-${from}-${to}.csv`,
      ["Position", "Betrag CHF"],
      incomeStatement.map((line) => [line.label, line.amount])
    )
  }

  const exportBalance = () => {
    downloadCsv(
      `bilanz-${to}.csv`,
      ["Bereich", "Position", "Betrag CHF"],
      balanceSheet.map((line) => [line.section, line.label, line.amount])
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={cn("text-lg font-semibold", adminUi.heading)}>Berichte</h2>
          <p className={cn("text-sm", adminUi.muted)}>
            Interne Übersicht: Kontenblatt, Journal, Erfolgsrechnung und Bilanz
          </p>
        </div>
        <div className={cn("flex flex-wrap gap-2 rounded-xl border p-2", adminUi.section)}>
          {(
            [
              ["kontenblatt", "Kontenblatt"],
              ["journal", "Journal"],
              ["erfolgsrechnung", "Erfolgsrechnung"],
              ["bilanz", "Bilanz"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setView(id)
                setSearch("")
              }}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                view === id ? adminUi.navActive : adminUi.navInactive
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}
      {actionError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}

      <div className={cn("space-y-4 rounded-xl border p-4 sm:p-6", adminUi.card)}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {view === "kontenblatt" && (
              <div className="space-y-1 sm:col-span-2">
                <label className={cn("text-xs font-medium", adminUi.label)}>Konto</label>
                <select
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
                >
                  <option value="">Alle Konten</option>
                  {data.accounts.map((item) => (
                    <option key={item.number} value={item.number}>
                      {item.number} — {item.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className={cn("text-xs font-medium", adminUi.label)}>Von</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={adminUi.input} />
            </div>
            <div className="space-y-1">
              <label className={cn("text-xs font-medium", adminUi.label)}>
                {view === "bilanz" ? "Stichtag" : "Bis"}
              </label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={adminUi.input} />
            </div>
            {(view === "kontenblatt" || view === "journal") && (
              <div className="space-y-1 sm:col-span-2">
                <label className={cn("text-xs font-medium", adminUi.label)}>Suche</label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Text, Betrag, Beleg-Nr…"
                  className={adminUi.input}
                />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className={adminUi.outlineBtn} onClick={() => void loadReports()}>
              Aktualisieren
            </Button>
            {view === "kontenblatt" && <ExportButton onClick={exportLedger} disabled={!ledgerRows.length} />}
            {view === "journal" && <ExportButton onClick={exportJournal} disabled={!journalRows.length} />}
            {view === "erfolgsrechnung" && <ExportButton onClick={exportIncome} />}
            {view === "bilanz" && <ExportButton onClick={exportBalance} />}
          </div>
        </div>

        {loading ? (
          <p className={cn("flex items-center text-sm", adminUi.muted)}>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Berichte werden geladen…
          </p>
        ) : view === "kontenblatt" ? (
          <div className={adminUi.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow className={adminUi.tableHeadRow}>
                  <TableHead>Datum</TableHead>
                  <TableHead>Beleg-Nr</TableHead>
                  <TableHead>Buchungstext</TableHead>
                  <TableHead>Gegenkonto</TableHead>
                  <TableHead className="text-right">Soll (+)</TableHead>
                  <TableHead className="text-right">Haben (-)</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className={cn("text-sm", adminUi.muted)}>
                      Keine Buchungen im gewählten Zeitraum.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerRows.map((row, index) => (
                    <TableRow key={`${row.entryId}-${index}`} className={adminUi.tableRow}>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell className="font-mono text-xs">{row.belegNummer}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell className="text-xs">{row.gegenkonto}</TableCell>
                      <TableCell className="text-right">{row.soll ? formatChf(row.soll) : ""}</TableCell>
                      <TableCell className="text-right">{row.haben ? formatChf(row.haben) : ""}</TableCell>
                      <TableCell className="text-right font-medium">{formatChf(row.saldo)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : view === "journal" ? (
          <div className={adminUi.tableWrap}>
            <Table>
              <TableHeader>
                <TableRow className={adminUi.tableHeadRow}>
                  <TableHead>Beleg-Nr</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Soll-Konto</TableHead>
                  <TableHead>Haben-Konto</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>MWST-Code</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead className="w-24 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journalRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className={cn("text-sm", adminUi.muted)}>
                      Keine Buchungen gefunden.
                    </TableCell>
                  </TableRow>
                ) : (
                  journalRows.map((row, index) => (
                    <TableRow key={`${row.entryId}-${index}`} className={adminUi.tableRow}>
                      <TableCell className="font-mono text-xs">{row.belegNummer}</TableCell>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell className="text-xs">{row.sollKonto}</TableCell>
                      <TableCell className="text-xs">{row.habenKonto}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell>{row.taxCode}</TableCell>
                      <TableCell className="text-right font-medium">{formatChf(row.amount)}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Buchung bearbeiten"
                            aria-label="Buchung bearbeiten"
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-orange-600 dark:hover:bg-zinc-800"
                            onClick={() => onEditEntry?.(row.entryId)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Buchung löschen"
                            aria-label="Buchung löschen"
                            disabled={deletingId === row.entryId}
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/40"
                            onClick={() =>
                              void handleDeleteEntry(row.entryId, row.belegNummer)
                            }
                          >
                            {deletingId === row.entryId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : view === "erfolgsrechnung" ? (
          <div className="space-y-2">
            <p className={cn("text-sm", adminUi.muted)}>
              Interne Erfolgsrechnung nach Schweizer KMU-Kontenrahmen ({from} – {to}).
              Gruppen mit Pfeil sind aufklappbar.
            </p>
            <div className={adminUi.tableWrap}>
              <Table>
                <TableBody>
                  {incomeStatement.map((line) => {
                    const canExpand = Boolean(line.expandable)
                    const isOpen = Boolean(expanded[line.id])
                    return (
                      <Fragment key={line.id}>
                        <TableRow className={adminUi.tableRow}>
                          <TableCell
                            className={cn(
                              line.level === 0 && "font-semibold",
                              line.level === 1 && "pl-4",
                              line.level === 2 && "pl-8 text-sm"
                            )}
                          >
                            {canExpand ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-left hover:underline"
                                onClick={() => toggleExpanded(line.id)}
                              >
                                {isOpen ? (
                                  <ChevronDown className="h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0" />
                                )}
                                {line.label}
                              </button>
                            ) : (
                              line.label
                            )}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-medium",
                              line.emphasis && "font-bold",
                              line.amount > 0
                                ? "text-emerald-600"
                                : line.amount < 0
                                  ? "text-red-600"
                                  : undefined
                            )}
                          >
                            {formatChf(line.amount)}
                          </TableCell>
                        </TableRow>
                        {canExpand && isOpen && (
                          <AccountDetailRows
                            accounts={line.accounts ?? []}
                            indentClass={line.level === 1 ? "pl-12" : "pl-16"}
                          />
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {(["aktiven", "passiven"] as const).map((section) => (
              <div key={section} className={adminUi.tableWrap}>
                <Table>
                  <TableBody>
                    {balanceSheet
                      .filter((line) => line.section === section)
                      .map((line) => {
                        const canExpand = Boolean(line.expandable)
                        const isOpen = Boolean(expanded[line.id])
                        return (
                          <Fragment key={line.id}>
                            <TableRow className={adminUi.tableRow}>
                              <TableCell
                                className={cn(
                                  line.level === 0 && "font-semibold uppercase",
                                  line.level === 1 && "pl-2",
                                  line.level === 2 && "pl-6 text-sm"
                                )}
                              >
                                {canExpand ? (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 text-left hover:underline"
                                    onClick={() => toggleExpanded(line.id)}
                                  >
                                    {isOpen ? (
                                      <ChevronDown className="h-4 w-4 shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 shrink-0" />
                                    )}
                                    {line.label}
                                  </button>
                                ) : (
                                  line.label
                                )}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right font-medium",
                                  line.emphasis && "font-bold"
                                )}
                              >
                                {formatChf(line.amount)}
                              </TableCell>
                            </TableRow>
                            {canExpand && isOpen && (
                              <AccountDetailRows
                                accounts={line.accounts ?? []}
                                indentClass={
                                  line.level === 1
                                    ? "pl-8"
                                    : line.level === 2
                                      ? "pl-12"
                                      : "pl-4"
                                }
                              />
                            )}
                          </Fragment>
                        )
                      })}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
