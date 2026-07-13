"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { CashFlowSummary } from "@/lib/accounting/dashboard-stats"
import { defaultYearRange } from "@/lib/accounting/dashboard-stats"
import { formatChf } from "@/lib/admin/format-chf"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type DashboardPayload = {
  from: string
  to: string
  label: string
  summary: CashFlowSummary
}

const YEAR_OPTIONS = [2025, 2026, 2027]

export function AdminAccountingDashboardPanel() {
  const [year, setYear] = useState(2026)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardPayload | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/accounting/dashboard?year=${year}`, {
        cache: "no-store",
      })
      const json = (await res.json()) as DashboardPayload & { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Dashboard konnte nicht geladen werden.")
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard konnte nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    void load()
  }, [load])

  const chartData = useMemo(
    () =>
      data?.summary.months.map((month) => ({
        name: month.label.replace(` ${year}`, ""),
        Einnahmen: month.income,
        Ausgaben: month.expense,
      })) ?? [],
    [data, year]
  )

  const rangeLabel = data?.label ?? defaultYearRange(year).label

  return (
    <section className={cn("space-y-6 rounded-xl border p-4 sm:p-6", adminUi.card)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className={cn("text-lg font-semibold", adminUi.heading)}>
          Flüssige Mittel Eingänge und Ausgänge
        </h2>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className={cn("h-10 rounded-md border px-3 text-sm", adminUi.select)}
          aria-label="Zeitraum"
        >
          {YEAR_OPTIONS.map((option) => (
            <option key={option} value={option}>
              01.01.{option} - 31.12.{option}
            </option>
          ))}
        </select>
      </div>

      {error && <p className={adminUi.error}>{error}</p>}

      {loading ? (
        <p className={cn("flex items-center text-sm", adminUi.muted)}>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Dashboard wird geladen…
        </p>
      ) : (
        <>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatChf(Number(value ?? 0))}
                  labelFormatter={(label) => `${label} ${year}`}
                />
                <Legend />
                <Bar dataKey="Einnahmen" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Ausgaben" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Total Einnahmen ({rangeLabel})
              </p>
              <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatChf(data?.summary.totalIncome ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                Total Ausgaben ({rangeLabel})
              </p>
              <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">
                {formatChf(data?.summary.totalExpense ?? 0)}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
