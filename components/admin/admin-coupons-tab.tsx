"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { Loader2, Plus, RefreshCw, Tag, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import type { CouponDiscountType, StoredCoupon } from "@/lib/admin/coupon-types"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

function formatDiscount(coupon: StoredCoupon): string {
  return coupon.discountType === "percent"
    ? `${coupon.discountValue}%`
    : `CHF ${coupon.discountValue.toFixed(2)}`
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium" }).format(
    new Date(iso)
  )
}

export function AdminCouponsTab() {
  const [coupons, setCoupons] = useState<StoredCoupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [code, setCode] = useState("")
  const [discountType, setDiscountType] = useState<CouponDiscountType>("percent")
  const [discountValue, setDiscountValue] = useState("20")
  const [expiresAt, setExpiresAt] = useState("")
  const [maxRedemptions, setMaxRedemptions] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/coupons", { cache: "no-store" })
      const data = (await res.json()) as {
        coupons?: StoredCoupon[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setCoupons(data.coupons ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gutscheine konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          discountType,
          discountValue: Number(discountValue) || 0,
          expiresAt: expiresAt.trim() || null,
          maxRedemptions: maxRedemptions.trim()
            ? Number(maxRedemptions)
            : null,
        }),
      })
      const data = (await res.json()) as { coupon?: StoredCoupon; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Anlegen fehlgeschlagen")
      if (data.coupon) {
        setCoupons((prev) => [data.coupon!, ...prev])
      }
      setCode("")
      setDiscountValue("20")
      setExpiresAt("")
      setMaxRedemptions("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gutschein konnte nicht erstellt werden.")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (coupon: StoredCoupon) => {
    const res = await fetch(`/api/admin/coupons/${encodeURIComponent(coupon.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktiv: !coupon.aktiv }),
    })
    const data = (await res.json()) as { coupon?: StoredCoupon; error?: string }
    if (!res.ok) {
      setError(data.error ?? "Update fehlgeschlagen")
      return
    }
    if (data.coupon) {
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? data.coupon! : c))
      )
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Gutschein wirklich löschen?")) return
    const res = await fetch(`/api/admin/coupons/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      setError(data.error ?? "Löschen fehlgeschlagen")
      return
    }
    setCoupons((prev) => prev.filter((c) => c.id !== id))
  }

  if (loading && coupons.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-24", adminUi.loader)}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Gutscheine werden geladen…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={cn("flex items-center gap-2 text-xl font-bold", adminUi.heading)}>
            <Tag className="h-5 w-5 text-orange-500" />
            Gutscheine & Rabatte
          </h2>
          <p className={cn("text-sm", adminUi.muted)}>
            Marketing-Codes für den Checkout — gespeichert in Cosmos DB
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

      <form
        onSubmit={handleCreate}
        className={cn(
          "grid gap-4 rounded-xl border p-5 sm:grid-cols-2 lg:grid-cols-3",
          adminUi.card
        )}
      >
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <Label className={adminUi.label}>Code-Name</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LAUNCH20"
            className={cn("font-mono uppercase", adminUi.input)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label className={adminUi.label}>Rabatt-Typ</Label>
          <select
            value={discountType}
            onChange={(e) =>
              setDiscountType(e.target.value as CouponDiscountType)
            }
            className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
          >
            <option value="percent">Prozentual (%)</option>
            <option value="fixed">Fixer Betrag (CHF)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label className={adminUi.label}>Wert</Label>
          <Input
            type="number"
            min={0}
            max={discountType === "percent" ? 100 : undefined}
            step={discountType === "percent" ? 1 : 0.05}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className={adminUi.input}
            required
          />
        </div>
        <div className="space-y-2">
          <Label className={adminUi.label}>Ablaufdatum (optional)</Label>
          <Input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={adminUi.input}
          />
        </div>
        <div className="space-y-2">
          <Label className={adminUi.label}>Max. Nutzungen (optional)</Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="Unbegrenzt"
            className={adminUi.input}
          />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-3">
          <Button
            type="submit"
            disabled={saving || !code.trim()}
            className={adminUi.primaryBtn}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Gutschein anlegen
          </Button>
        </div>
      </form>

      <div className={adminUi.tableWrap}>
        <Table>
          <TableHeader>
            <TableRow className={adminUi.tableHeadRow}>
              <TableHead className={adminUi.tableHead}>Code</TableHead>
              <TableHead className={adminUi.tableHead}>Rabatt</TableHead>
              <TableHead className={adminUi.tableHead}>Ablauf</TableHead>
              <TableHead className={adminUi.tableHead}>Nutzung</TableHead>
              <TableHead className={adminUi.tableHead}>Status</TableHead>
              <TableHead className={adminUi.tableHead} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {coupons.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className={cn("py-12 text-center text-sm", adminUi.muted)}
                >
                  Noch keine Gutscheine angelegt.
                </TableCell>
              </TableRow>
            ) : (
              coupons.map((coupon) => (
                <TableRow key={coupon.id} className={adminUi.tableRow}>
                  <TableCell className={cn("font-mono font-semibold", adminUi.accentTitle)}>
                    {coupon.code}
                  </TableCell>
                  <TableCell className={adminUi.tableCell}>
                    {formatDiscount(coupon)}
                  </TableCell>
                  <TableCell className={adminUi.bodyText}>
                    {formatExpiry(coupon.expiresAt)}
                  </TableCell>
                  <TableCell className={cn("tabular-nums", adminUi.bodyText)}>
                    {coupon.redemptionCount}
                    {coupon.maxRedemptions != null
                      ? ` / ${coupon.maxRedemptions}`
                      : " / ∞"}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={adminUi.outlineBtn}
                      onClick={() => void toggleActive(coupon)}
                    >
                      <Badge
                        variant="outline"
                        className={
                          coupon.aktiv
                            ? "border-green-500/40 text-green-700 dark:text-green-300"
                            : adminUi.badgeInactive
                        }
                      >
                        {coupon.aktiv ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-red-600 dark:text-red-400"
                      onClick={() => void handleDelete(coupon.id)}
                      aria-label="Gutschein löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
