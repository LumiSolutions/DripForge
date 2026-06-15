"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { ProductTag } from "@/lib/admin/product-tags"
import { cn } from "@/lib/utils"

type ShopTagFilterPanelProps = {
  tags: ProductTag[]
  selectedTagIds: string[]
  onToggleTag: (tagId: string, checked: boolean) => void
  onClear: () => void
  className?: string
}

export function ShopTagFilterPanel({
  tags,
  selectedTagIds,
  onToggleTag,
  onClear,
  className,
}: ShopTagFilterPanelProps) {
  const safeTags = tags ?? []
  const safeSelectedTagIds = selectedTagIds ?? []
  const hasActiveTagFilters = safeSelectedTagIds.length > 0

  if (safeTags.length === 0) return null

  return (
    <aside
      className={cn(
        "rounded-2xl border border-border/50 bg-card/50 p-5",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Tags</h3>
        {hasActiveTagFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={onClear}
          >
            Tags zurücksetzen
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Verfeinern</Label>
        <div className="space-y-2">
          {safeTags.map((tag) => {
            const tagId = tag?.id
            if (!tagId) return null

            return (
            <label
              key={tagId}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-sm hover:bg-secondary/40"
            >
              <Checkbox
                checked={safeSelectedTagIds.includes(tagId)}
                onCheckedChange={(checked) => onToggleTag(tagId, checked === true)}
              />
              <span>{tag?.name ?? "Tag"}</span>
            </label>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
