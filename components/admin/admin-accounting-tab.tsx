"use client"

import { useCallback, useEffect, useState } from "react"
import { BookOpen } from "lucide-react"
import { AdminAccountingChartPanel } from "@/components/admin/admin-accounting-chart-panel"
import { AdminAccountingDashboardPanel } from "@/components/admin/admin-accounting-dashboard-panel"
import { AdminAccountingManualPanel } from "@/components/admin/admin-accounting-manual-panel"
import { AdminAccountingReportsPanel } from "@/components/admin/admin-accounting-reports-panel"
import { AdminAccountingTaxCodesPanel } from "@/components/admin/admin-accounting-tax-codes-panel"
import type { Account, AccountKind } from "@/lib/accounting/account-types"
import type { TaxCode } from "@/lib/accounting/tax-code-types"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type AccountingSubview = "dashboard" | "manual" | "accounts" | "tax-codes" | "reports"

export function AdminAccountingTab({
  initialView = "dashboard",
  settingsOnly = false,
}: {
  initialView?: AccountingSubview
  /** Nur Konten & Steuersätze (für Buchhaltungseinstellungen) */
  settingsOnly?: boolean
} = {}) {
  const [view, setView] = useState<AccountingSubview>(
    settingsOnly ? initialView === "tax-codes" ? "tax-codes" : "accounts" : initialView
  )
  const [editEntryId, setEditEntryId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [loadingTaxCodes, setLoadingTaxCodes] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/accounting/accounts", { cache: "no-store" })
      const data = (await res.json()) as { accounts?: Account[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Konten konnten nicht geladen werden.")
      setAccounts(data.accounts ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konten konnten nicht geladen werden.")
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  const loadTaxCodes = useCallback(async () => {
    setLoadingTaxCodes(true)
    try {
      const res = await fetch("/api/admin/accounting/tax-codes?ensure=1", {
        cache: "no-store",
      })
      const data = (await res.json()) as { taxCodes?: TaxCode[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Steuercodes konnten nicht geladen werden.")
      setTaxCodes(data.taxCodes ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Steuercodes konnten nicht geladen werden.")
    } finally {
      setLoadingTaxCodes(false)
    }
  }, [])

  useEffect(() => {
    void loadAccounts()
    void loadTaxCodes()
  }, [loadAccounts, loadTaxCodes])

  const handleSaveAccount = async (payload: {
    number: string
    name: string
    group: string | null
    type: AccountKind
    vatBookable: boolean
    defaultVatRate: number
    defaultTaxCode: string | null
    originalNumber?: string
  }) => {
    setSaving(true)
    setError(null)
    try {
      if (payload.originalNumber) {
        const res = await fetch(
          `/api/admin/accounting/accounts/${encodeURIComponent(payload.originalNumber)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: payload.name,
              group: payload.group,
              type: payload.type,
              vatBookable: payload.vatBookable,
              defaultVatRate: payload.defaultVatRate,
              defaultTaxCode: payload.defaultTaxCode,
            }),
          }
        )
        const data = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(data.error ?? "Konto konnte nicht gespeichert werden.")
      } else {
        const res = await fetch("/api/admin/accounting/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(data.error ?? "Konto konnte nicht erstellt werden.")
      }
      await loadAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.")
      throw err
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async (number: string) => {
    if (!window.confirm(`Konto ${number} wirklich löschen?`)) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/accounting/accounts/${encodeURIComponent(number)}`,
        { method: "DELETE" }
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Konto konnte nicht gelöscht werden.")
      await loadAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.")
    } finally {
      setSaving(false)
    }
  }

  const handleCopyAccount = (account: Account) => {
    const suffix = "-kopie"
    const suggested = `${account.number}${suffix}`.slice(0, 20)
    void handleSaveAccount({
      number: suggested,
      name: `${account.name} (Kopie)`,
      group: account.group,
      type: account.type === "Gruppe" ? "Aktiv" : account.type,
      vatBookable: account.vatBookable ?? false,
      defaultVatRate: account.defaultVatRate ?? 0.081,
      defaultTaxCode: account.defaultTaxCode ?? null,
    }).catch(() => undefined)
  }

  const handleDeactivateAccount = async (account: Account) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/accounting/accounts/${encodeURIComponent(account.number)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        }
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Konto konnte nicht deaktiviert werden.")
      await loadAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deaktivieren fehlgeschlagen.")
    } finally {
      setSaving(false)
    }
  }

  const handleEditConsumed = useCallback(() => {
    setEditEntryId(null)
  }, [])

  const handleEditFromReports = useCallback((entryId: string) => {
    setEditEntryId(entryId)
    setView("manual")
  }, [])

  const viewOptions = (
    settingsOnly
      ? ([
          ["accounts", "Kontenplan"],
          ["tax-codes", "MWST-Sätze"],
        ] as const)
      : ([
          ["dashboard", "Dashboard / Übersicht"],
          ["manual", "Manuelle Buchung"],
          ["reports", "Berichte"],
          ["accounts", "Kontenplan"],
          ["tax-codes", "MWST-Sätze"],
        ] as const)
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={cn("text-2xl font-bold", adminUi.heading)}>
            <BookOpen className="mr-2 inline h-6 w-6 text-orange-500" />
            {settingsOnly ? "Buchhaltungseinstellungen" : "Buchhaltung"}
          </h1>
          <p className={cn("mt-1 text-sm", adminUi.muted)}>
            {settingsOnly
              ? "Kontenplan, MWST-Sätze sowie Firmendaten und Checkout-MwSt."
              : "Schweizer KMU-Buchhaltung mit Journal, Buchungsmaske und Kontenplan"}
          </p>
        </div>
        <div className={cn("flex flex-wrap gap-2 rounded-xl border p-2", adminUi.section)}>
          {viewOptions.map(([id, label]) => (
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

      {view === "dashboard" && <AdminAccountingDashboardPanel />}
      {view === "manual" && (
        <AdminAccountingManualPanel
          accounts={accounts}
          taxCodes={taxCodes}
          editEntryId={editEntryId}
          onEditConsumed={handleEditConsumed}
          onBooked={() => undefined}
        />
      )}
      {view === "accounts" && (
        <AdminAccountingChartPanel
          accounts={accounts}
          taxCodes={taxCodes}
          loading={loadingAccounts || loadingTaxCodes}
          saving={saving}
          error={error}
          onRefresh={() => {
            void loadAccounts()
            void loadTaxCodes()
          }}
          onSave={handleSaveAccount}
          onDelete={handleDeleteAccount}
          onCopy={handleCopyAccount}
          onDeactivate={handleDeactivateAccount}
        />
      )}
      {view === "tax-codes" && (
        <AdminAccountingTaxCodesPanel />
      )}
      {view === "reports" && (
        <AdminAccountingReportsPanel onEditEntry={handleEditFromReports} />
      )}
    </div>
  )
}
