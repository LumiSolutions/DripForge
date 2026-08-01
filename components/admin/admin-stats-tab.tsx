"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BarChart3,
  Clock,
  Globe2,
  Loader2,
  MapPin,
  RefreshCw,
  Save,
  ShoppingCart,
  TrendingUp,
  Users,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AdminAnalytics } from "@/lib/admin/analytics-types"
import type { VisitorAnalyticsSnapshot } from "@/lib/admin/visitor-sessions"
import type { AdminSettings } from "@/lib/admin/types"
import { formatChf } from "@/lib/admin/format-chf"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  DEFAULT_SHOW_TOP_PRODUCTS_ON_HOMEPAGE,
  DEFAULT_TOP_PRODUCTS_COUNT,
  MAX_TOP_PRODUCTS_COUNT,
  MIN_TOP_PRODUCTS_COUNT,
  normalizeShowTopProductsOnHomepage,
  normalizeTopProductsCount,
} from "@/lib/dripforge/top-products-settings"
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
  const [showTopProductsOnHomepage, setShowTopProductsOnHomepage] = useState(
    DEFAULT_SHOW_TOP_PRODUCTS_ON_HOMEPAGE
  )
  const [topProductsCount, setTopProductsCount] = useState(DEFAULT_TOP_PRODUCTS_COUNT)
  const [topProductsSettingsLoading, setTopProductsSettingsLoading] = useState(true)
  const [topProductsSettingsSaving, setTopProductsSettingsSaving] = useState(false)
  const [topProductsSettingsError, setTopProductsSettingsError] = useState<string | null>(
    null
  )
  const [topProductsSettingsSuccess, setTopProductsSettingsSuccess] = useState<
    string | null
  >(null)
  const [visitors, setVisitors] = useState<VisitorAnalyticsSnapshot | null>(null)
  const [visitorsLoading, setVisitorsLoading] = useState(true)
  const [chartDays, setChartDays] = useState<30 | 90 | 365>(90)
  const [viewsMode, setViewsMode] = useState<"day" | "month" | "year">("day")
  const [viewsYearFilter, setViewsYearFilter] = useState<string>("all")
  const [viewsMonthFilter, setViewsMonthFilter] = useState<string>("all")
  const [peakMode, setPeakMode] = useState<"weekday" | "month" | "hour">(
    "weekday"
  )
  const settingsSnapshotRef = useRef<AdminSettings | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/analytics?days=${chartDays}`, {
        cache: "no-store",
      })
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
  }, [chartDays])

  const loadTopProductsSettings = useCallback(async () => {
    setTopProductsSettingsLoading(true)
    setTopProductsSettingsError(null)
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" })
      const json = (await res.json()) as AdminSettings & { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Einstellungen nicht verfügbar")
      settingsSnapshotRef.current = json
      setShowTopProductsOnHomepage(
        normalizeShowTopProductsOnHomepage(json.showTopProductsOnHomepage)
      )
      setTopProductsCount(normalizeTopProductsCount(json.topProductsCount))
    } catch (err) {
      console.warn("Admin: Top-Produkte-Einstellungen konnten nicht geladen werden.", err)
      setTopProductsSettingsError(
        err instanceof Error
          ? err.message
          : "Top-Produkte-Einstellungen konnten nicht geladen werden."
      )
    } finally {
      setTopProductsSettingsLoading(false)
    }
  }, [])

  const saveTopProductsSettings = useCallback(async () => {
    const snapshot = settingsSnapshotRef.current
    if (!snapshot?.checkout) {
      setTopProductsSettingsError("Einstellungen noch nicht geladen.")
      return
    }
    setTopProductsSettingsSaving(true)
    setTopProductsSettingsError(null)
    setTopProductsSettingsSuccess(null)
    try {
      const count = normalizeTopProductsCount(topProductsCount)
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkout: snapshot.checkout,
          company: snapshot.company,
          services: snapshot.services,
          shopConfigurators: snapshot.shopConfigurators,
          showSupportOnMainSite: snapshot.showSupportOnMainSite,
          showSupportOnCountdownPage: snapshot.showSupportOnCountdownPage,
          enableOnboardingTour: snapshot.enableOnboardingTour,
          onboardingTourText: snapshot.onboardingTourText,
          themeInboundTourImageUrl: snapshot.themeInboundTourImageUrl,
          enableRewardPointsSystem: snapshot.enableRewardPointsSystem,
          loyaltyEarnPercent: snapshot.loyaltyEarnPercent,
          loyaltyPointValueChf: snapshot.loyaltyPointValueChf,
          loyaltyPointsExpiryMonths: snapshot.loyaltyPointsExpiryMonths,
          orderEmailTemplates: snapshot.orderEmailTemplates,
          orderEmailLayout: snapshot.orderEmailLayout,
          launch: snapshot.launch,
          showTopProductsOnHomepage,
          topProductsCount: count,
        }),
      })
      const json = (await res.json()) as AdminSettings & { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Speichern fehlgeschlagen")
      settingsSnapshotRef.current = json
      setShowTopProductsOnHomepage(
        normalizeShowTopProductsOnHomepage(json.showTopProductsOnHomepage)
      )
      setTopProductsCount(normalizeTopProductsCount(json.topProductsCount))
      setTopProductsSettingsSuccess("Gespeichert")
    } catch (err) {
      console.warn("Admin: Top-Produkte-Einstellungen konnten nicht gespeichert werden.", err)
      setTopProductsSettingsError(
        err instanceof Error
          ? err.message
          : "Top-Produkte-Einstellungen konnten nicht gespeichert werden."
      )
    } finally {
      setTopProductsSettingsSaving(false)
    }
  }, [showTopProductsOnHomepage, topProductsCount])

  const loadVisitors = useCallback(async () => {
    setVisitorsLoading(true)
    try {
      const res = await fetch("/api/admin/visitors", { cache: "no-store" })
      const json = (await res.json()) as VisitorAnalyticsSnapshot
      if (res.ok) setVisitors(json)
    } catch (err) {
      console.warn("Admin: Besucherstatistik nicht verfügbar.", err)
    } finally {
      setVisitorsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadTopProductsSettings()
  }, [loadTopProductsSettings])

  useEffect(() => {
    void loadVisitors()
    const id = window.setInterval(() => void loadVisitors(), 30_000)
    return () => window.clearInterval(id)
  }, [loadVisitors])

  const chartData = useMemo(
    () =>
      (data?.timeSeries ?? []).map((point) => ({
        ...point,
        label: formatChartDate(point.date),
      })),
    [data?.timeSeries]
  )

  const viewsChartData = useMemo(() => {
    if (!visitors) return []
    if (viewsMode === "day") {
      let rows = visitors.viewsByDay ?? []
      if (viewsYearFilter !== "all") {
        rows = rows.filter((r) => r.key.startsWith(`${viewsYearFilter}-`))
      }
      if (viewsMonthFilter !== "all") {
        rows = rows.filter((r) => r.key.slice(5, 7) === viewsMonthFilter)
      }
      return rows
    }
    if (viewsMode === "month") {
      let rows = visitors.viewsByMonth ?? []
      if (viewsYearFilter !== "all") {
        rows = rows.filter((r) => r.key.startsWith(`${viewsYearFilter}-`))
      }
      return rows
    }
    return visitors.viewsByYear ?? []
  }, [visitors, viewsMode, viewsYearFilter, viewsMonthFilter])

  const viewsYearOptions = useMemo(() => {
    const years = new Set<string>()
    for (const row of visitors?.viewsByDay ?? []) {
      years.add(row.key.slice(0, 4))
    }
    for (const row of visitors?.viewsByYear ?? []) {
      years.add(row.key)
    }
    return Array.from(years).sort()
  }, [visitors])

  const peakChartData = useMemo(() => {
    if (!visitors) return []
    if (peakMode === "weekday") return visitors.heatmapWeekday ?? []
    if (peakMode === "month") return visitors.heatmapMonth ?? []
    return visitors.heatmapHour ?? []
  }, [visitors, peakMode])

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
          onClick={() => {
            void load()
            void loadVisitors()
          }}
          disabled={loading || visitorsLoading}
          className={adminUi.outlineBtn}
        >
          <RefreshCw
            className={cn(
              "mr-2 h-4 w-4",
              (loading || visitorsLoading) && "animate-spin"
            )}
          />
          Aktualisieren
        </Button>
      </div>

      {error && <p className={adminUi.errorLg}>{error}</p>}

      {/* Zeile 1: 3 Besucher-Karten */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Aktuelle aktive Besucher"
          value={visitors ? String(visitors.onlineCount) : visitorsLoading ? "…" : "0"}
          hint="Aktiv in den letzten 2 Minuten (anonymisiert)"
          icon={Users}
        />
        <MetricCard
          label="Regionen erfasst"
          value={visitors ? String(visitors.byRegion.length) : "—"}
          hint="Land / Kanton / Bundesland"
          icon={Globe2}
        />
        <MetricCard
          label="Live-Stand"
          value={
            visitors?.generatedAt
              ? new Intl.DateTimeFormat("de-CH", { timeStyle: "medium" }).format(
                  new Date(visitors.generatedAt)
                )
              : "—"
          }
          hint="Automatische Aktualisierung alle 30 s"
          icon={MapPin}
        />
      </div>

      {/* Zeile 2: 4 Kennzahlen */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Gesamtumsatz"
          value={formatChf(summary?.totalRevenueChf ?? 0)}
          hint="Stornierungen abgezogen"
          icon={Wallet}
        />
        <MetricCard
          label="Bestellungen"
          value={String(summary?.orderCount ?? 0)}
          icon={ShoppingCart}
        />
        <MetricCard
          label="Offene Bestellungen"
          value={String(summary?.openOrderCount ?? 0)}
          hint="Ausstehend & in Produktion"
          icon={Clock}
        />
        <MetricCard
          label="Durchschnittlicher Bestellwert"
          value={formatChf(summary?.averageOrderValueChf ?? 0)}
          icon={TrendingUp}
        />
      </div>

      {/* Zeile 3: 3 Charts nebeneinander */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className={adminUi.card}>
          <CardHeader className="space-y-3 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className={cn("flex items-center gap-2 text-base", adminUi.heading)}>
                <BarChart3 className="h-4 w-4 text-orange-500" />
                Verlauf
              </CardTitle>
              <select
                aria-label="Zeitraum Verlauf"
                value={chartDays}
                onChange={(e) =>
                  setChartDays(Number(e.target.value) as 30 | 90 | 365)
                }
                className={cn(
                  "h-9 rounded-md border px-2 text-sm",
                  adminUi.input
                )}
              >
                <option value={30}>Letzte 30 Tage</option>
                <option value={90}>Letzte 90 Tage</option>
                <option value={365}>Letzte 365 Tage</option>
              </select>
            </div>
            <p className={cn("text-sm", adminUi.muted)}>
              Bestellungen und Umsatz (Schweizer Zeit)
            </p>
          </CardHeader>
          <CardContent className="h-[260px] w-full pb-4">
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
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-700/40" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip
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
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenueChf"
                    name="Umsatz"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className={adminUi.card}>
          <CardHeader className="space-y-3 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className={cn("flex items-center gap-2 text-base", adminUi.heading)}>
                <BarChart3 className="h-4 w-4 text-orange-500" />
                Aufrufe
              </CardTitle>
              <select
                aria-label="Aufrufe Aggregation"
                value={viewsMode}
                onChange={(e) =>
                  setViewsMode(e.target.value as "day" | "month" | "year")
                }
                className={cn("h-9 rounded-md border px-2 text-sm", adminUi.input)}
              >
                <option value="day">Pro Tag</option>
                <option value="month">Pro Monat</option>
                <option value="year">Pro Jahr</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Jahr filtern"
                value={viewsYearFilter}
                onChange={(e) => setViewsYearFilter(e.target.value)}
                className={cn("h-9 rounded-md border px-2 text-sm", adminUi.input)}
              >
                <option value="all">Alle Jahre</option>
                {viewsYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              {viewsMode === "day" && (
                <select
                  aria-label="Monat filtern"
                  value={viewsMonthFilter}
                  onChange={(e) => setViewsMonthFilter(e.target.value)}
                  className={cn("h-9 rounded-md border px-2 text-sm", adminUi.input)}
                >
                  <option value="all">Alle Monate</option>
                  {[
                    ["01", "Jan"],
                    ["02", "Feb"],
                    ["03", "Mär"],
                    ["04", "Apr"],
                    ["05", "Mai"],
                    ["06", "Jun"],
                    ["07", "Jul"],
                    ["08", "Aug"],
                    ["09", "Sep"],
                    ["10", "Okt"],
                    ["11", "Nov"],
                    ["12", "Dez"],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </CardHeader>
          <CardContent className="h-[260px] pb-4">
            {viewsChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={viewsChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Aufrufe"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className={cn("text-sm", adminUi.muted)}>Noch keine Aufrufdaten.</p>
            )}
          </CardContent>
        </Card>

        <Card className={adminUi.card}>
          <CardHeader className="space-y-3 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className={cn("flex items-center gap-2 text-base", adminUi.heading)}>
                Peak-Zeiten
              </CardTitle>
              <select
                aria-label="Peak-Zeiten Ansicht"
                value={peakMode}
                onChange={(e) =>
                  setPeakMode(e.target.value as "weekday" | "month" | "hour")
                }
                className={cn("h-9 rounded-md border px-2 text-sm", adminUi.input)}
              >
                <option value="weekday">Wochentage (Mo–So)</option>
                <option value="month">Monate (Jan–Dez)</option>
                <option value="hour">Uhrzeit (00:00–23:59)</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="h-[260px] pb-4">
            {peakChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={peakChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    interval={peakMode === "hour" ? 3 : 0}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Aufrufe"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={peakMode !== "hour"}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className={cn("text-sm", adminUi.muted)}>Noch keine Peak-Daten.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Zeile 4: 5 Tabellen */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <Card className={adminUi.card}>
          <CardHeader>
            <CardTitle className={cn("text-base", adminUi.heading)}>Top Produkte</CardTitle>
            <p className={cn("text-sm", adminUi.muted)}>Nach Umsatz und Stueckzahl</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-2",
                adminUi.section
              )}
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <Label
                  htmlFor="top-products-homepage-switch"
                  className={cn("text-sm font-medium leading-snug", adminUi.heading)}
                >
                  Auf Startseite
                </Label>
                <Switch
                  id="top-products-homepage-switch"
                  checked={showTopProductsOnHomepage}
                  disabled={topProductsSettingsLoading || topProductsSettingsSaving}
                  onCheckedChange={setShowTopProductsOnHomepage}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="top-products-count"
                  className={cn("shrink-0 text-sm", adminUi.label)}
                >
                  Anzahl
                </Label>
                <Input
                  id="top-products-count"
                  type="number"
                  min={MIN_TOP_PRODUCTS_COUNT}
                  max={MAX_TOP_PRODUCTS_COUNT}
                  value={topProductsCount}
                  disabled={
                    topProductsSettingsLoading ||
                    topProductsSettingsSaving ||
                    !showTopProductsOnHomepage
                  }
                  onChange={(e) =>
                    setTopProductsCount(normalizeTopProductsCount(e.target.value))
                  }
                  className={cn("h-9 w-16 tabular-nums", adminUi.input)}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void saveTopProductsSettings()}
                  disabled={topProductsSettingsLoading || topProductsSettingsSaving}
                  className={cn("shrink-0", adminUi.primaryBtn)}
                >
                  {topProductsSettingsSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              {topProductsSettingsError && (
                <p className={cn("w-full text-xs", adminUi.error)}>
                  {topProductsSettingsError}
                </p>
              )}
              {topProductsSettingsSuccess && !topProductsSettingsError && (
                <p className="w-full text-xs text-emerald-600 dark:text-emerald-400">
                  {topProductsSettingsSuccess}
                </p>
              )}
            </div>

            {pieProducts.length === 0 ? (
              <p className={cn("py-6 text-center text-sm", adminUi.muted)}>
                Keine Produktdaten vorhanden.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="mx-auto h-[140px] w-full max-w-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieProducts}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={52}
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
                <div className={cn("min-w-0", adminUi.tableWrap)}>
                  <Table>
                    <TableHeader>
                      <TableRow className={adminUi.tableHeadRow}>
                        <TableHead className={cn("py-1.5", adminUi.tableHead)}>
                          Produkt
                        </TableHead>
                        <TableHead className={cn("py-1.5 text-right", adminUi.tableHead)}>
                          Stk.
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.topProducts ?? []).map((row) => (
                        <TableRow key={row.name} className={adminUi.tableRow}>
                          <TableCell
                            className={cn(
                              "max-w-[120px] truncate py-1.5",
                              adminUi.tableCell
                            )}
                          >
                            {row.name}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "py-1.5 text-right tabular-nums",
                              adminUi.bodyText
                            )}
                          >
                            {row.quantity}
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
              Materialien, Farben, Filamente
            </p>
          </CardHeader>
          <CardContent>
            {(data?.topOptions ?? []).length === 0 ? (
              <p className={cn("py-6 text-center text-sm", adminUi.muted)}>
                Noch keine Konfigurationsdaten.
              </p>
            ) : (
              <div className={adminUi.tableWrap}>
                <Table>
                  <TableHeader>
                    <TableRow className={adminUi.tableHeadRow}>
                      <TableHead className={cn("py-1.5", adminUi.tableHead)}>
                        Option
                      </TableHead>
                      <TableHead className={cn("py-1.5 text-right", adminUi.tableHead)}>
                        #
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.topOptions.map((row) => (
                      <TableRow
                        key={`${row.category}-${row.label}`}
                        className={adminUi.tableRow}
                      >
                        <TableCell className={cn("py-1.5", adminUi.tableCell)}>
                          <span className={cn("block text-xs", adminUi.muted)}>
                            {row.category}
                          </span>
                          {row.label}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "py-1.5 text-right font-semibold tabular-nums",
                            adminUi.accentTitle
                          )}
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

        <Card className={adminUi.card}>
          <CardHeader>
            <CardTitle className={cn("text-base", adminUi.heading)}>Top Käufer</CardTitle>
            <p className={cn("text-sm", adminUi.muted)}>
              Ohne stornierte Bestellungen
            </p>
          </CardHeader>
          <CardContent>
            {(data?.topBuyers ?? []).length === 0 ? (
              <p className={cn("py-6 text-center text-sm", adminUi.muted)}>
                Noch keine Kundendaten.
              </p>
            ) : (
              <div className={adminUi.tableWrap}>
                <Table>
                  <TableHeader>
                    <TableRow className={adminUi.tableHeadRow}>
                      <TableHead className={cn("py-1.5", adminUi.tableHead)}>
                        Kunde
                      </TableHead>
                      <TableHead className={cn("py-1.5 text-right", adminUi.tableHead)}>
                        Umsatz
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.topBuyers.map((row) => (
                      <TableRow key={row.email} className={adminUi.tableRow}>
                        <TableCell className={cn("py-1.5", adminUi.tableCell)}>
                          <p className="truncate font-medium">{row.name}</p>
                          <p className={cn("truncate text-xs", adminUi.muted)}>
                            {row.orderCount} Best.
                          </p>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "py-1.5 text-right font-medium tabular-nums",
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

        <Card className={adminUi.card}>
          <CardHeader className="pb-2">
            <CardTitle className={cn("flex items-center gap-2 text-base", adminUi.heading)}>
              <Globe2 className="h-4 w-4 text-orange-500" />
              Top Länder
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visitorsLoading && !visitors ? (
              <p className={cn("flex items-center text-sm", adminUi.muted)}>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Laden…
              </p>
            ) : !visitors?.byCountry?.length ? (
              <p className={cn("text-sm", adminUi.muted)}>Noch keine Länderdaten.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Land</TableHead>
                      <TableHead className="text-right">Aufrufe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitors.byCountry.slice(0, 12).map((row) => (
                      <TableRow key={`country-${row.countryCode}`}>
                        <TableCell className="font-medium">{row.regionLabel}</TableCell>
                        <TableCell className="text-right tabular-nums">
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

        <Card className={adminUi.card}>
          <CardHeader className="pb-2">
            <CardTitle className={cn("flex items-center gap-2 text-base", adminUi.heading)}>
              <MapPin className="h-4 w-4 text-orange-500" />
              Besucher nach Region
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visitorsLoading && !visitors ? (
              <p className={cn("flex items-center text-sm", adminUi.muted)}>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Regionen…
              </p>
            ) : !visitors?.byRegion.length ? (
              <p className={cn("text-sm", adminUi.muted)}>
                Noch keine regionalen Aufrufe erfasst.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Region</TableHead>
                      <TableHead className="text-right">Aufrufe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitors.byRegion.slice(0, 20).map((row) => (
                      <TableRow
                        key={`${row.countryCode}-${row.regionCode}-${row.regionLabel}`}
                      >
                        <TableCell className="font-medium">
                          <span className="block">{row.regionLabel}</span>
                          <span className={cn("text-xs", adminUi.muted)}>
                            {row.countryCode}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
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
    </div>
  )
}
