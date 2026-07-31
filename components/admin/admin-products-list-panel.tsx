"use client"

import { useMemo, useState } from "react"
import {
  Filter,
  Loader2,
  MoreHorizontal,
  Pencil,
  Tag,
  Trash2,
  ToggleLeft,
  Percent,
  Archive,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AdminProduct } from "@/lib/admin/types"
import type { ProductTag } from "@/lib/admin/product-tags"
import { sortProducts, type ProductSortMode } from "@/lib/admin/list-sort-utils"
import {
  calculateSalePrice,
  type SaleRabattTyp,
} from "@/lib/dripforge/product-sale"
import {
  getProductShopStatus,
  productShopStatusLabel,
  type ProductShopStatus,
} from "@/lib/admin/product-status"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type AdminProductsListPanelProps = {
  products: AdminProduct[]
  productTags: ProductTag[]
  productSort: ProductSortMode
  onProductSortChange: (mode: ProductSortMode) => void
  activeProductId?: string
  onEdit: (product: AdminProduct) => void
  onRefresh: () => Promise<void>
  /** Festen Status-Filter setzen (z. B. Archiv-Tab) */
  lockedStatusFilter?: StatusFilter
  emptyMessage?: string
}

type TypeFilter = "all" | "3d" | "laser"
export type StatusFilter = "all" | "active" | "inactive" | "sale"

function statusBadgeClass(status: ProductShopStatus): string {
  switch (status) {
    case "inactive":
      return cn(adminUi.badgeInactive, "bg-slate-100 text-slate-500 dark:bg-zinc-800/80 dark:text-zinc-400")
    case "sale":
      return "bg-orange-500/20 text-orange-300 hover:bg-orange-500/30"
    default:
      return "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
  }
}

export function AdminProductsListPanel({
  products,
  productTags,
  productSort,
  onProductSortChange,
  activeProductId,
  onEdit,
  onRefresh,
  lockedStatusFilter,
  emptyMessage,
}: AdminProductsListPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [tagFilter, setTagFilter] = useState<string>("all")
  const [saleDialogOpen, setSaleDialogOpen] = useState(false)
  const [saleTargetIds, setSaleTargetIds] = useState<string[]>([])
  const [saleRabattTyp, setSaleRabattTyp] = useState<SaleRabattTyp>("percent")
  const [saleRabattWert, setSaleRabattWert] = useState("10")
  const [saleFormError, setSaleFormError] = useState<string | null>(null)

  const effectiveStatusFilter = lockedStatusFilter ?? statusFilter

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (typeFilter !== "all" && product.type !== typeFilter) return false
      const shopStatus = getProductShopStatus(product)
      if (effectiveStatusFilter === "active" && shopStatus !== "active") return false
      if (effectiveStatusFilter === "inactive" && shopStatus !== "inactive") return false
      if (effectiveStatusFilter === "sale" && shopStatus !== "sale") return false
      if (tagFilter !== "all" && !(product.tags ?? []).includes(tagFilter)) return false
      return true
    })
  }, [products, typeFilter, effectiveStatusFilter, tagFilter])

  const sortedProducts = useMemo(
    () => sortProducts(filteredProducts, productSort),
    [filteredProducts, productSort]
  )

  const visibleIds = useMemo(
    () => new Set(sortedProducts.map((product) => product.id)),
    [sortedProducts]
  )

  const effectiveSelectedIds = useMemo(
    () => selectedIds.filter((id) => visibleIds.has(id)),
    [selectedIds, visibleIds]
  )

  const tagNameById = useMemo(
    () => new Map(productTags.map((tag) => [tag.id, tag.name])),
    [productTags]
  )

  const selectedVisibleCount = effectiveSelectedIds.length
  const allSelected =
    sortedProducts.length > 0 && selectedVisibleCount === sortedProducts.length
  const someSelected = selectedVisibleCount > 0 && !allSelected

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? sortedProducts.map((p) => p.id) : [])
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = prev.filter((entry) => visibleIds.has(entry) || entry === id)
      return checked
        ? [...new Set([...next, id])]
        : next.filter((entry) => entry !== id)
    })
  }

  const runBulk = async (
    body: Record<string, unknown>,
    options?: { clearSelection?: boolean; ids?: string[] }
  ) => {
    setBulkBusy(true)
    setBulkError(null)
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: options?.ids ?? effectiveSelectedIds,
          ...body,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Bulk-Aktion fehlgeschlagen")
      if (options?.clearSelection !== false) {
        setSelectedIds([])
      }
      await onRefresh()
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Bulk-Aktion fehlgeschlagen")
    } finally {
      setBulkBusy(false)
    }
  }

  const setProductStatus = async (
    productIds: string[],
    status: ProductShopStatus,
    options?: { clearSelection?: boolean }
  ) => {
    if (status === "sale") {
      const needsSaleDialog = productIds.some((id) => {
        const product = products.find((entry) => entry.id === id)
        return product != null && !product.sale
      })
      if (needsSaleDialog) {
        setSaleTargetIds(productIds)
        setSaleRabattTyp("percent")
        setSaleRabattWert("10")
        setSaleFormError(null)
        setSaleDialogOpen(true)
        return
      }
    }

    if (productIds.length === 1) {
      setStatusBusyId(productIds[0]!)
    } else {
      setBulkBusy(true)
    }
    setBulkError(null)
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: productIds,
          patch: { status },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Status konnte nicht geändert werden")
      if (options?.clearSelection !== false && productIds.length > 1) {
        setSelectedIds([])
      }
      await onRefresh()
    } catch (err) {
      setBulkError(
        err instanceof Error ? err.message : "Status konnte nicht geändert werden"
      )
    } finally {
      setStatusBusyId(null)
      setBulkBusy(false)
    }
  }

  const bulkDelete = () => {
    if (
      !confirm(
        `${effectiveSelectedIds.length} Produkt(e) wirklich löschen? Dies kann nicht rückgängig gemacht werden.`
      )
    ) {
      return
    }
    void runBulk({ action: "delete" })
  }

  const bulkTags = async (tagIds: string[], mode: "add" | "remove") => {
    if (tagIds.length === 0) return
    await runBulk({
      patch: mode === "add" ? { tagsAdd: tagIds } : { tagsRemove: tagIds },
    })
  }

  const openSaleDialog = () => {
    setSaleTargetIds(effectiveSelectedIds)
    setSaleRabattTyp("percent")
    setSaleRabattWert("10")
    setSaleFormError(null)
    setSaleDialogOpen(true)
  }

  const applyBulkSale = async () => {
    const wert = Number(saleRabattWert)
    if (!Number.isFinite(wert) || wert <= 0) {
      setSaleFormError("Der Rabatt-Wert muss größer als 0 sein.")
      return
    }
    if (saleRabattTyp === "percent" && wert >= 100) {
      setSaleFormError("Prozent-Rabatt muss unter 100% liegen.")
      return
    }

    setSaleFormError(null)
    await runBulk(
      {
        patch: {
          status: "sale",
          sale: true,
          saleRabattTyp,
          saleRabattWert: wert,
        },
      },
      { ids: saleTargetIds }
    )
    setSaleDialogOpen(false)
    setSaleTargetIds([])
  }

  const salePreviewEnd =
    saleRabattTyp === "percent"
      ? calculateSalePrice(100, "percent", Number(saleRabattWert) || 0)
      : calculateSalePrice(100, "fixed", Number(saleRabattWert) || 0)

  const hasActiveFilters =
    typeFilter !== "all" ||
    (!lockedStatusFilter && effectiveStatusFilter !== "all") ||
    tagFilter !== "all"

  const busy = bulkBusy || statusBusyId != null

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={cn("text-sm", adminUi.muted)}>
            {lockedStatusFilter === "inactive" ? (
              <>
                <Archive className="mr-1.5 inline h-3.5 w-3.5" />
                {filteredProducts.length} archivierte / inaktive Produkt
                {filteredProducts.length !== 1 ? "e" : ""}
              </>
            ) : filteredProducts.length === products.length ? (
              `${products.length} Produkte im Shop`
            ) : (
              `${filteredProducts.length} von ${products.length} Produkten angezeigt`
            )}
          </p>
          <Select
            value={productSort}
            onValueChange={(v) => onProductSortChange(v as ProductSortMode)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sortierung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A–Z)</SelectItem>
              <SelectItem value="price-asc">Preis (aufsteigend)</SelectItem>
              <SelectItem value="price-desc">Preis (absteigend)</SelectItem>
              <SelectItem value="created-desc">Neueste zuerst</SelectItem>
              <SelectItem value="created-asc">Älteste zuerst</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5",
            adminUi.section
          )}
        >
          <Filter className={cn("h-4 w-4 shrink-0", adminUi.muted)} />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Typ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              <SelectItem value="3d">3D-Druck</SelectItem>
              <SelectItem value="laser">Laser</SelectItem>
            </SelectContent>
          </Select>
          {!lockedStatusFilter && (
            <Select
              value={effectiveStatusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="inactive">Inaktiv / Archiviert</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Tags</SelectItem>
              {productTags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn("text-xs", adminUi.muted)}
              onClick={() => {
                setTypeFilter("all")
                if (!lockedStatusFilter) setStatusFilter("all")
                setTagFilter("all")
              }}
            >
              Filter zurücksetzen
            </Button>
          )}
        </div>
      </div>

      {bulkError && <p className={cn("text-sm", adminUi.error)}>{bulkError}</p>}

      {effectiveSelectedIds.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3",
            adminUi.section
          )}
        >
          <span className={cn("text-sm font-medium", adminUi.heading)}>
            {effectiveSelectedIds.length} ausgewählt
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={adminUi.outlineBtn}
                disabled={busy || productTags.length === 0}
              >
                <Tag className="mr-1.5 h-4 w-4" />
                Tags zuweisen
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Tags hinzufügen</DropdownMenuLabel>
              {productTags.map((tag) => (
                <DropdownMenuItem
                  key={`add-${tag.id}`}
                  onClick={() => void bulkTags([tag.id], "add")}
                >
                  + {tag.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Tags entfernen</DropdownMenuLabel>
              {productTags.map((tag) => (
                <DropdownMenuItem
                  key={`remove-${tag.id}`}
                  onClick={() => void bulkTags([tag.id], "remove")}
                >
                  − {tag.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={adminUi.outlineBtn}
                disabled={busy}
              >
                <ToggleLeft className="mr-1.5 h-4 w-4" />
                Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() =>
                  void setProductStatus(effectiveSelectedIds, "active")
                }
              >
                Aktiv setzen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openSaleDialog}>
                <Percent className="mr-2 h-4 w-4" />
                Sale setzen…
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  void setProductStatus(effectiveSelectedIds, "inactive")
                }
              >
                Inaktiv / Archivieren
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => void runBulk({ patch: { sale: false } })}
              >
                Sale deaktivieren
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-red-500/40 text-red-500 hover:bg-red-500/10"
            disabled={busy}
            onClick={bulkDelete}
          >
            {bulkBusy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-4 w-4" />
            )}
            Löschen
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={adminUi.muted}
            disabled={busy}
            onClick={() => setSelectedIds([])}
          >
            Auswahl aufheben
          </Button>
        </div>
      )}

      <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sale für {saleTargetIds.length} Produkt(e)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className={cn("text-sm", adminUi.muted)}>
              Rabatt wird für alle ausgewählten Produkte gleich angewendet. Der Basispreis
              jedes Produkts bleibt erhalten. Produkte werden zugleich aktiv gesetzt.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={adminUi.label}>Rabatt-Typ</Label>
                <select
                  value={saleRabattTyp}
                  onChange={(e) => setSaleRabattTyp(e.target.value as SaleRabattTyp)}
                  className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
                >
                  <option value="percent">Prozent (%)</option>
                  <option value="fixed">Fixer Betrag (CHF)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className={adminUi.label}>Rabatt-Wert</Label>
                <Input
                  type="number"
                  step={saleRabattTyp === "fixed" ? "0.01" : "1"}
                  min="0"
                  value={saleRabattWert}
                  onChange={(e) => setSaleRabattWert(e.target.value)}
                  placeholder={saleRabattTyp === "fixed" ? "5.00" : "20"}
                  className={adminUi.input}
                />
              </div>
            </div>
            {saleFormError && (
              <p className="text-sm text-red-600 dark:text-red-400">{saleFormError}</p>
            )}
            <p className={cn("text-xs", adminUi.muted)}>
              Beispiel: CHF 100.00 → CHF {salePreviewEnd.toFixed(2)} Endpreis
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={adminUi.outlineBtn}
              onClick={() => setSaleDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className={adminUi.primaryBtn}
              disabled={busy}
              onClick={() => void applyBulkSale()}
            >
              {bulkBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Percent className="mr-2 h-4 w-4" />
              )}
              Sale anwenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className={cn("overflow-hidden rounded-xl border", adminUi.section)}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  aria-label="Alle sichtbaren Produkte auswählen"
                />
              </TableHead>
              <TableHead>Produkt</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Preis</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className={cn("py-10 text-center text-sm", adminUi.muted)}>
                  {emptyMessage ??
                    (products.length === 0
                      ? "Noch keine Produkte vorhanden."
                      : "Keine Produkte entsprechen den Filtern.")}
                </TableCell>
              </TableRow>
            ) : (
              sortedProducts.map((product) => {
                const checked = effectiveSelectedIds.includes(product.id)
                const productTagIds = product.tags ?? []
                const shopStatus = getProductShopStatus(product)
                const rowBusy = statusBusyId === product.id
                return (
                  <TableRow
                    key={product.id}
                    className={cn(
                      activeProductId === product.id && "bg-primary/5",
                      checked && "bg-muted/30",
                      shopStatus === "inactive" && "opacity-80"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleOne(product.id, value === true)}
                        aria-label={`${product.name} auswählen`}
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => onEdit(product)}
                        className={cn("text-left font-medium hover:underline", adminUi.heading)}
                      >
                        {product.name}
                      </button>
                    </TableCell>
                    <TableCell className={cn("text-sm", adminUi.muted)}>
                      {product.type === "3d" ? "3D-Druck" : "Laser"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      CHF {product.price.toFixed(2)}
                      {product.sale && product.originalPrice != null && (
                        <span className={cn("ml-1 text-xs line-through", adminUi.muted)}>
                          {product.originalPrice.toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {productTagIds.length === 0 ? (
                          <span className={cn("text-xs", adminUi.muted)}>—</span>
                        ) : (
                          productTagIds.slice(0, 3).map((tagId) => (
                            <Badge key={tagId} variant="secondary" className="text-xs">
                              {tagNameById.get(tagId) ?? tagId}
                            </Badge>
                          ))
                        )}
                        {productTagIds.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{productTagIds.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            disabled={rowBusy || bulkBusy}
                            className="inline-flex items-center gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Status von ${product.name} ändern`}
                            title="Status ändern"
                          >
                            {rowBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            ) : (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "cursor-pointer text-xs transition-opacity hover:opacity-90",
                                  statusBadgeClass(shopStatus)
                                )}
                              >
                                {productShopStatusLabel(shopStatus)}
                              </Badge>
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuLabel>Status setzen</DropdownMenuLabel>
                          <DropdownMenuItem
                            disabled={shopStatus === "active"}
                            onClick={() => void setProductStatus([product.id], "active", {
                              clearSelection: false,
                            })}
                          >
                            Aktiv
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={shopStatus === "sale"}
                            onClick={() => void setProductStatus([product.id], "sale", {
                              clearSelection: false,
                            })}
                          >
                            Sale
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={shopStatus === "inactive"}
                            onClick={() =>
                              void setProductStatus([product.id], "inactive", {
                                clearSelection: false,
                              })
                            }
                          >
                            Inaktiv / Archivieren
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Aktionen für ${product.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(product)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={shopStatus === "active"}
                            onClick={() =>
                              void setProductStatus([product.id], "active", {
                                clearSelection: false,
                              })
                            }
                          >
                            Aktiv setzen
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={shopStatus === "sale"}
                            onClick={() =>
                              void setProductStatus([product.id], "sale", {
                                clearSelection: false,
                              })
                            }
                          >
                            Sale setzen
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={shopStatus === "inactive"}
                            onClick={() =>
                              void setProductStatus([product.id], "inactive", {
                                clearSelection: false,
                              })
                            }
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            Archivieren
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
