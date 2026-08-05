"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  PAYMENT_OPTIONS,
  SHIPPING_OPTIONS,
  type PaymentMethodId,
  type ShippingMethodId,
} from "@/lib/dripforge/checkout-config"
import {
  ADMIN_CUSTOMER_CATEGORIES_CHANGED,
  clampDiscountPercent,
  createEmptyCustomerCategory,
  normalizeCustomerCategories,
  type CustomerCategory,
} from "@/lib/dripforge/customer-categories"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

export function AdminCustomerCategoriesCard() {
  const [categories, setCategories] = useState<CustomerCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/customer-categories", {
          cache: "no-store",
        })
        const data = await res.json().catch(() => null)
        if (!cancelled) {
          setCategories(normalizeCustomerCategories(data?.customerCategories))
        }
      } catch {
        if (!cancelled) setError("Kategorien konnten nicht geladen werden.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const update = (id: string, patch: Partial<CustomerCategory>) =>
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    )

  const toggleShipping = (id: string, methodId: ShippingMethodId) =>
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        const has = c.allowedShippingMethodIds.includes(methodId)
        return {
          ...c,
          allowedShippingMethodIds: has
            ? c.allowedShippingMethodIds.filter((m) => m !== methodId)
            : [...c.allowedShippingMethodIds, methodId],
        }
      })
    )

  const togglePayment = (id: string, methodId: PaymentMethodId) =>
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        const has = c.allowedPaymentMethodIds.includes(methodId)
        return {
          ...c,
          allowedPaymentMethodIds: has
            ? c.allowedPaymentMethodIds.filter((m) => m !== methodId)
            : [...c.allowedPaymentMethodIds, methodId],
        }
      })
    )

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async () => {
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      const res = await fetch("/api/admin/customer-categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerCategories: normalizeCustomerCategories(categories),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "Speichern fehlgeschlagen")
      const next = normalizeCustomerCategories(data?.customerCategories)
      setCategories(next)
      setNotice("Kundenkategorien gespeichert.")
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(ADMIN_CUSTOMER_CATEGORIES_CHANGED, {
            detail: { customerCategories: next },
          })
        )
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={adminUi.card}>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className={cn("text-lg font-bold", adminUi.heading)}>
              Kundenkategorien
            </h3>
            <p className={cn("mt-1 text-sm", adminUi.muted)}>
              Gruppen mit Rabatt und erlaubten Versandarten (z. B. Friends &
              Family, B2B). Details per Pfeil ausklappen.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const created = createEmptyCustomerCategory()
              setCategories((prev) => [...prev, created])
              setExpandedIds((prev) => new Set(prev).add(created.id))
            }}
          >
            + Kategorie
          </Button>
        </div>

        {loading ? (
          <p className={cn("text-sm", adminUi.muted)}>Lädt …</p>
        ) : categories.length === 0 ? (
          <p className={cn("text-sm", adminUi.muted)}>
            Noch keine Kategorien angelegt.
          </p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => {
              const open = expandedIds.has(cat.id)
              const summaryParts = [
                cat.discountPercent > 0 ? `${cat.discountPercent}% Rabatt` : null,
                cat.allowedShippingMethodIds.length > 0
                  ? `${cat.allowedShippingMethodIds.length} Versandarten`
                  : null,
                cat.allowedPaymentMethodIds.length > 0
                  ? `${cat.allowedPaymentMethodIds.length} Zahlungsarten`
                  : null,
              ].filter(Boolean)

              return (
                <Collapsible
                  key={cat.id}
                  open={open}
                  onOpenChange={() => toggleExpanded(cat.id)}
                >
                  <div className="rounded-lg border border-border/60">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          aria-label={`${cat.name || "Kategorie"} ${open ? "einklappen" : "ausklappen"}`}
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                              open && "rotate-180"
                            )}
                          />
                          <span className="truncate font-medium">
                            {cat.name.trim() || "Unbenannte Kategorie"}
                          </span>
                          {!open && summaryParts.length > 0 && (
                            <span className={cn("hidden truncate text-xs sm:inline", adminUi.muted)}>
                              · {summaryParts.join(" · ")}
                            </span>
                          )}
                        </button>
                      </CollapsibleTrigger>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-red-600 hover:text-red-700"
                        onClick={() =>
                          setCategories((prev) =>
                            prev.filter((c) => c.id !== cat.id)
                          )
                        }
                      >
                        Entfernen
                      </Button>
                    </div>

                    <CollapsibleContent>
                      <div className="space-y-3 border-t border-border/50 px-4 py-3">
                        <div className="grid gap-3 sm:grid-cols-[1fr_140px] sm:items-end">
                          <div className="space-y-1">
                            <Label className={adminUi.label}>Name</Label>
                            <Input
                              value={cat.name}
                              onChange={(e) =>
                                update(cat.id, { name: e.target.value })
                              }
                              placeholder="z. B. Friends & Family"
                              className={adminUi.input}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className={adminUi.label}>Rabatt %</Label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={cat.discountPercent}
                              onChange={(e) =>
                                update(cat.id, {
                                  discountPercent: clampDiscountPercent(
                                    e.target.value
                                  ),
                                })
                              }
                              className={adminUi.input}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className={adminUi.label}>
                            Erlaubte Versandarten
                          </Label>
                          <div className="flex flex-wrap gap-3">
                            {SHIPPING_OPTIONS.map((opt) => {
                              const checked =
                                cat.allowedShippingMethodIds.includes(opt.id)
                              return (
                                <label
                                  key={opt.id}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      toggleShipping(cat.id, opt.id)
                                    }
                                  />
                                  {opt.label}
                                </label>
                              )
                            })}
                          </div>
                          <p className={cn("text-xs", adminUi.muted)}>
                            Keine Auswahl = alle Versandarten erlaubt.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label className={adminUi.label}>
                            Erlaubte Zahlungsarten
                          </Label>
                          <div className="flex flex-wrap gap-3">
                            {PAYMENT_OPTIONS.map((opt) => {
                              const checked =
                                cat.allowedPaymentMethodIds.includes(opt.id)
                              return (
                                <label
                                  key={opt.id}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      togglePayment(cat.id, opt.id)
                                    }
                                  />
                                  {opt.label}
                                </label>
                              )
                            })}
                          </div>
                          <p className={cn("text-xs", adminUi.muted)}>
                            Keine Auswahl = alle Zahlungsarten erlaubt.
                          </p>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>
        )}

        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Speichern …" : "Kategorien speichern"}
        </Button>
      </CardContent>
    </Card>
  )
}
