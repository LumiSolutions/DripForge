"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  Clock,
  Loader2,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react"
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AdminAnalytics } from "@/lib/admin/analytics-types"
import { formatChf } from "@/lib/admin/format-chf"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

const PIE_COLORS = [
  "#f97316",
  "#06b6d4",
  "#a855f7",
  "#22c55e",
  "#eab308",
  "#ec4899",
  "#64748b",
  "#ef4444",
]

function formatChartDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "short",
  }).format(new Date(y, m - 1, d))
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Wallet
}) {
  return (
    <Card className={adminUi.card}>
      <CardContent className="flex items-start gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500 dark:text-orange-400">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className={cn("text-xs font-medium uppercase tracking-wide", adminUi.muted)}>
            {label}
          </p>
          <p className={cn("mt-1 text-2xl font-bold tabular-nums", adminUi.heading)}>
            {value}
          </p>
          {hint && <p className={cn("mt-1 text-xs", adminUi.muted)}>{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminStatsTab() {
  const [data, setData] = useState<AdminAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/analytics", { cache: "no-store" })
      const json = (await res.json()) as AdminAnalytics
      if (!res.ok) throw new Error("Statistiken nicht verfügbar")
      setData(json)
    } catch (err) {
      console.warn("Admin: Statistiken konnten nicht geladen werden.", err)
      setError(
        err instanceof Error ? err.message : "Statistiken konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const chartData = useMemo(
    () =>
      (data?.timeSeries ?? []).map((point) => ({
        ...point,
        label: formatChartDate(point.date),
      })),
    [data?.timeSeries]
  )

  const pieProducts = useMemo(
    () =>
      (data?.topProducts ?? []).map((p) => ({
        name: p.name.length > 28 ? `${p.name.slice(0, 26)}…` : p.name,
        fullName: p.name,
        value: p.quantity,
        revenueChf: p.revenueChf,
      })),
    [data?.topProducts]
  )

  if (loading && !data) {
    return (
      <div className={cn("flex items-center justify-center py-24", adminUi.loader)}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Statistiken werden geladen…
      </div>
    )
  }

  const summary = data?.summary

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={cn("text-xl font-bold", adminUi.heading)}>
            Dashboard / Statistiken
          </h2>
          <p className={cn("text-sm", adminUi.muted)}>
            Auswertung aller Bestellungen
            {data?.generatedAt
              ? ` · Stand ${new Intl.DateTimeFormat("de-CH", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(data.generatedAt))}`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
          className={adminUi.outlineBtn}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Aktualisieren
        </Button>
      </div>

      {error && <p className={adminUi.errorLg}>{error}</p>}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Gesamtumsatz"
            value={formatChf(summary.totalRevenueChf)}
            hint="Ohne stornierte Bestellungen"
            icon={Wallet}
          />
          <MetricCard
            label="Anzahl Bestellungen"
            value={String(summary.orderCount)}
            icon={ShoppingCart}
          />
          <MetricCard
            label="Offene Bestellungen"
            value={String(summary.openOrderCount)}
            hint="Ausstehend & in Produktion"
            icon={Clock}
          />
          <MetricCard
            label="Ø Bestellwert"
            value={formatChf(summary.averageOrderValueChf)}
            icon={TrendingUp}
          />
        </div>
      )}

      <Card className={adminUi.card}>
        <CardHeader className="pb-2">
          <CardTitle className={cn("flex items-center gap-2 text-base", adminUi.heading)}>
            <BarChart3 className="h-4 w-4 text-orange-500" />
            Verlauf (letzte 90 Tage)
          </CardTitle>
          <p className={cn("text-sm", adminUi.muted)}>
            Bestellungen und Umsatz nach Tag (Schweizer Zeit)
          </p>
        </CardHeader>
        <CardContent className="h-[320px] w-full pb-4">
          {chartData.length === 0 ? (
            <div
              className={cn(
                "flex h-full items-center justify-center rounded-xl border border-dashed text-sm",
                adminUi.empty
              )}
            >
              Noch keine Bestelldaten für den Verlauf.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-700/40" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  className="text-zinc-500"
                />
                <YAxis
                  yAxisId="left"
                  allowDecimals={false}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  className="text-zinc-500"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  tickFormatter={(v) => `CHF ${v}`}
                  className="text-zinc-500"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgb(24 24 27)",
                    border: "1px solid rgb(63 63 70)",
                    borderRadius: "0.75rem",
                  }}
                  labelStyle={{ color: "#fafafa" }}
                  formatter={(value, name) => {
                    const num = Number(value)
                    if (name === "Umsatz") return [formatChf(num), name]
                    return [num, name]
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="orders"
                  name="Bestellungen"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenueChf"
                  name="Umsatz"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className={adminUi.card}>
          <CardHeader>
            <CardTitle className={cn("text-base", adminUi.heading)}>Top-Produkte</CardTitle>
            <p className={cn("text-sm", adminUi.muted)}>Nach Umsatz und Stueckzahl</p>
          </CardHeader>
          <CardContent>
            {pieProducts.length === 0 ? (
              <p className={cn("py-8 text-center text-sm", adminUi.muted)}>
                Keine Produktdaten vorhanden.
              </p>
            ) : (
              <div className="flex flex-col gap-6 md:flex-row md:items-center">
                <div className="mx-auto h-[220px] w-full max-w-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieProducts}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {pieProducts.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, _name, item) => {
                          const payload = item?.payload as {
                            fullName?: string
                            revenueChf?: number
                          }
                          return [
                            `${value} Stk. · ${formatChf(payload?.revenueChf ?? 0)}`,
                            payload?.fullName ?? "",
                          ]
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className={cn("min-w-0 flex-1", adminUi.tableWrap)}>
                  <Table>
                    <TableHeader>
                      <TableRow className={adminUi.tableHeadRow}>
                        <TableHead className={adminUi.tableHead}>Produkt</TableHead>
                        <TableHead className={cn("text-right", adminUi.tableHead)}>
                          Stk.
                        </TableHead>
                        <TableHead className={cn("text-right", adminUi.tableHead)}>
                          Umsatz
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.topProducts ?? []).map((row) => (
                        <TableRow key={row.name} className={adminUi.tableRow}>
                          <TableCell className={cn("max-w-[200px] truncate", adminUi.tableCell)}>
                            {row.name}
                          </TableCell>
                          <TableCell
                            className={cn("text-right tabular-nums", adminUi.bodyText)}
                          >
                            {row.quantity}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-medium tabular-nums",
                              adminUi.accentTitle
                            )}
                          >
                            {formatChf(row.revenueChf)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={adminUi.card}>
          <CardHeader>
            <CardTitle className={cn("text-base", adminUi.heading)}>
              Beliebte Optionen
            </CardTitle>
            <p className={cn("text-sm", adminUi.muted)}>
              Materialien, Farben, Filamente und Varianten
            </p>
          </CardHeader>
          <CardContent>
            {(data?.topOptions ?? []).length === 0 ? (
              <p className={cn("py-8 text-center text-sm", adminUi.muted)}>
                Noch keine Konfigurationsdaten in Bestellpositionen.
              </p>
            ) : (
              <div className={adminUi.tableWrap}>
                <Table>
                  <TableHeader>
                    <TableRow className={adminUi.tableHeadRow}>
                      <TableHead className={adminUi.tableHead}>Kategorie</TableHead>
                      <TableHead className={adminUi.tableHead}>Option</TableHead>
                      <TableHead className={cn("text-right", adminUi.tableHead)}>
                        Häufigkeit
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.topOptions.map((row) => (
                      <TableRow
                        key={`${row.category}-${row.label}`}
                        className={adminUi.tableRow}
                      >
                        <TableCell className={cn("text-sm", adminUi.muted)}>
                          {row.category}
                        </TableCell>
                        <TableCell className={adminUi.tableCell}>{row.label}</TableCell>
                        <TableCell
                          className={cn("text-right font-semibold tabular-nums", adminUi.accentTitle)}
                        >
                          {row.count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={adminUi.card}>
        <CardHeader>
          <CardTitle className={cn("text-base", adminUi.heading)}>
            Top-Käufer (Top 10)
          </CardTitle>
          <p className={cn("text-sm", adminUi.muted)}>
            Nach Gesamtumsatz ohne stornierte Bestellungen
          </p>
        </CardHeader>
        <CardContent>
          {(data?.topBuyers ?? []).length === 0 ? (
            <p className={cn("py-8 text-center text-sm", adminUi.muted)}>
              Noch keine Kundendaten vorhanden.
            </p>
          ) : (
            <div className={adminUi.tableWrap}>
              <Table>
                <TableHeader>
                  <TableRow className={adminUi.tableHeadRow}>
                    <TableHead className={cn("w-14", adminUi.tableHead)}>Rang</TableHead>
                    <TableHead className={adminUi.tableHead}>Kunde</TableHead>
                    <TableHead className={cn("text-right", adminUi.tableHead)}>
                      Bestellungen
                    </TableHead>
                    <TableHead className={cn("text-right", adminUi.tableHead)}>
                      Gesamtumsatz
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.topBuyers.map((row, index) => (
                    <TableRow key={row.email} className={adminUi.tableRow}>
                      <TableCell
                        className={cn("font-semibold tabular-nums", adminUi.accentTitle)}
                      >
                        #{index + 1}
                      </TableCell>
                      <TableCell className={adminUi.tableCell}>
                        <p className="font-medium">{row.name}</p>
                        <p className={cn("text-xs", adminUi.muted)}>{row.email}</p>
                      </TableCell>
                      <TableCell
                        className={cn("text-right tabular-nums", adminUi.bodyText)}
                      >
                        {row.orderCount}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          adminUi.accentTitle
                        )}
                      >
                        {formatChf(row.revenueChf)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
