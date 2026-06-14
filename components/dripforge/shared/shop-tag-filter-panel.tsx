"use client"

import { Tag } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { ProductTag } from "@/lib/admin/product-tags"
import { cn } from "@/lib/utils"

type ShopTagFilterPanelProps = {
  tags: ProductTag[]
  selectedTagIds: string[]
  saleOnly: boolean
  showSaleFilter: boolean
  onToggleTag: (tagId: string, checked: boolean) => void
  onToggleSale: (checked: boolean) => void
  onClear: () => void
  className?: string
}

export function ShopTagFilterPanel({
  tags,
  selectedTagIds,
  saleOnly,
  showSaleFilter,
  onToggleTag,
  onToggleSale,
  onClear,
  className,
}: ShopTagFilterPanelProps) {
  const hasActiveFilters = selectedTagIds.length > 0 || saleOnly

  return (
    <aside
      className={cn(
        "rounded-2xl border border-border/50 bg-card/50 p-5",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Filter</h3>
        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onClear}>
            Zurücksetzen
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {tags.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Kategorien</Label>
            <div className="space-y-2">
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-sm hover:bg-secondary/40"
                >
                  <Checkbox
                    checked={selectedTagIds.includes(tag.id)}
                    onCheckedChange={(checked) => onToggleTag(tag.id, checked === true)}
                  />
                  <span>{tag.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {showSaleFilter && (
          <div className="space-y-2 border-t border-border/50 pt-4">
            <Label className="text-xs text-muted-foreground">Angebote</Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-sm hover:bg-secondary/40">
              <Checkbox
                checked={saleOnly}
                onCheckedChange={(checked) => onToggleSale(checked === true)}
              />
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-red-400" />
                Rabatt / Sale
              </span>
            </label>
          </div>
        )}

        {tags.length === 0 && !showSaleFilter && (
          <p className="text-sm text-muted-foreground">Keine Filter verfügbar.</p>
        )}
      </div>
    </aside>
  )
}
