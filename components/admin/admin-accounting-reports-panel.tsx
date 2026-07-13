"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Loader2 } from "lucide-react"
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
import { downloadCsv } from "@/lib/accounting/export-csv"
import {
  matchesSearchQuery,
  type BalanceSheetLine,
  type IncomeStatementLine,
  type JournalReportRow,
  type LedgerRow,
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

export function AdminAccountingReportsPanel() {
  const year = new Date().getFullYear()
  const [view, setView] = useState<ReportSubview>("kontenblatt")
  const [from, setFrom] = useState(`${year}-01-01`)
  const [to, setTo] = useState(`${year}-12-31`)
  const [account, setAccount] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ReportsPayload | null>(null)

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ from, to })
      if (account) params.set("account", account)
      const res = await fetch(`/api/admin/accounting/reports?${params}`, {
        cache: "no-store",
      })
      const payload = (await res.json()) as ReportsPayload & { error?: string }
      if (!res.ok) throw new Error(payload.error ?? "Berichte konnten nicht geladen werden.")
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Berichte konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }, [from, to, account])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const ledgerRows = useMemo(() => {
    if (!data) return []
    return data.ledger.filter((row) =>
      matchesSearchQuery(search, [
        row.description,
        row.gegenkonto,
        row.belegNummer,
        row.soll,
        row.haben,
        row.saldo,
      ])
    )
  }, [data, search])

  const journalRows = useMemo(() => {
    if (!data) return []
    return data.journal.filter((row) =>
      matchesSearchQuery(search, [
        row.belegNummer,
        row.date,
        row.sollKonto,
        row.habenKonto,
        row.description,
        row.taxCode,
        row.amount,
      ])
    )
  }, [data, search])

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
    if (!data) return
    downloadCsv(
      `erfolgsrechnung-${from}-${to}.csv`,
      ["Position", "Betrag CHF"],
      data.incomeStatement.map((line) => [line.label, line.amount])
    )
  }

  const exportBalance = () => {
    if (!data) return
    downloadCsv(
      `bilanz-${to}.csv`,
      ["Bereich", "Position", "Betrag CHF"],
      data.balanceSheet.map((line) => [line.section, line.label, line.amount])
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
                  {(data?.accounts ?? []).map((item) => (
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
            {view === "erfolgsrechnung" && <ExportButton onClick={exportIncome} disabled={!data} />}
            {view === "bilanz" && <ExportButton onClick={exportBalance} disabled={!data} />}
          </div>
        </div>

        {error && <p className={adminUi.error}>{error}</p>}

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {journalRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className={cn("text-sm", adminUi.muted)}>
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : view === "erfolgsrechnung" ? (
          <div className="space-y-2">
            <p className={cn("text-sm", adminUi.muted)}>
              Interne Erfolgsrechnung nach Schweizer KMU-Kontenrahmen ({from} – {to})
            </p>
            <div className={adminUi.tableWrap}>
              <Table>
                <TableBody>
                  {(data?.incomeStatement ?? []).map((line) => (
                    <TableRow key={line.id} className={adminUi.tableRow}>
                      <TableCell
                        className={cn(
                          line.level === 0 && "font-semibold",
                          line.level === 1 && "pl-6",
                          line.level === 2 && "pl-10 text-sm"
                        )}
                      >
                        {line.label}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium",
                          line.emphasis && "font-bold",
                          line.amount >= 0 ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {formatChf(line.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
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
                    {(data?.balanceSheet ?? [])
                      .filter((line) => line.section === section)
                      .map((line) => (
                        <TableRow key={line.id} className={adminUi.tableRow}>
                          <TableCell
                            className={cn(
                              line.level === 0 && "font-semibold uppercase",
                              line.level === 1 && "pl-4",
                              line.level === 2 && "pl-8 text-sm"
                            )}
                          >
                            {line.label}
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
                      ))}
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
