"use client"

import { useMemo, useState } from "react"
import {
  Loader2,
  Pencil,
  Tag,
  Trash2,
  ToggleLeft,
  Percent,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
}

export function AdminProductsListPanel({
  products,
  productTags,
  productSort,
  onProductSortChange,
  activeProductId,
  onEdit,
  onRefresh,
}: AdminProductsListPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  const sortedProducts = useMemo(
    () => sortProducts(products, productSort),
    [products, productSort]
  )

  const tagNameById = useMemo(
    () => new Map(productTags.map((tag) => [tag.id, tag.name])),
    [productTags]
  )

  const allSelected =
    sortedProducts.length > 0 && selectedIds.length === sortedProducts.length
  const someSelected = selectedIds.length > 0 && !allSelected

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? sortedProducts.map((p) => p.id) : [])
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((entry) => entry !== id)
    )
  }

  const runBulk = async (body: Record<string, unknown>) => {
    setBulkBusy(true)
    setBulkError(null)
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, ...body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Bulk-Aktion fehlgeschlagen")
      setSelectedIds([])
      await onRefresh()
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Bulk-Aktion fehlgeschlagen")
    } finally {
      setBulkBusy(false)
    }
  }

  const bulkDelete = () => {
    if (
      !confirm(
        `${selectedIds.length} Produkt(e) wirklich löschen? Dies kann nicht rückgängig gemacht werden.`
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn("text-sm", adminUi.muted)}>
          {products.length} Produkte im Shop
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

      {bulkError && <p className={cn("text-sm", adminUi.error)}>{bulkError}</p>}

      {selectedIds.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3",
            adminUi.section
          )}
        >
          <span className={cn("text-sm font-medium", adminUi.heading)}>
            {selectedIds.length} ausgewählt
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={adminUi.outlineBtn}
                disabled={bulkBusy || productTags.length === 0}
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
                disabled={bulkBusy}
              >
                <ToggleLeft className="mr-1.5 h-4 w-4" />
                Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => void runBulk({ patch: { istAktiv: true } })}>
                Aktiv setzen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runBulk({ patch: { istAktiv: false } })}>
                Inaktiv setzen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void runBulk({ patch: { sale: true } })}>
                <Percent className="mr-2 h-4 w-4" />
                Sale aktivieren
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void runBulk({ patch: { sale: false } })}>
                Sale deaktivieren
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-red-500/40 text-red-500 hover:bg-red-500/10"
            disabled={bulkBusy}
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
            disabled={bulkBusy}
            onClick={() => setSelectedIds([])}
          >
            Auswahl aufheben
          </Button>
        </div>
      )}

      <div className={cn("overflow-hidden rounded-xl border", adminUi.section)}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  aria-label="Alle Produkte auswählen"
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
                  Noch keine Produkte vorhanden.
                </TableCell>
              </TableRow>
            ) : (
              sortedProducts.map((product) => {
                const checked = selectedIds.includes(product.id)
                const productTagIds = product.tags ?? []
                return (
                  <TableRow
                    key={product.id}
                    className={cn(
                      activeProductId === product.id && "bg-primary/5",
                      checked && "bg-muted/30"
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
                      <div className="flex flex-wrap gap-1">
                        {product.istAktiv === false && (
                          <Badge variant="outline" className={adminUi.badgeInactive}>
                            Inaktiv
                          </Badge>
                        )}
                        {product.sale && (
                          <Badge className="bg-orange-500/20 text-orange-300">Sale</Badge>
                        )}
                        {product.istAktiv !== false && !product.sale && (
                          <Badge variant="outline" className="text-xs">
                            Aktiv
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(product)}
                        aria-label={`${product.name} bearbeiten`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
