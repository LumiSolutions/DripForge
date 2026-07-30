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
  /** Grössere Touch-Ziele (Bottom-Sheet) */
  touchFriendly?: boolean
  dense?: boolean
}

export function ShopTagFilterPanel({
  tags,
  selectedTagIds,
  onToggleTag,
  onClear,
  className,
  touchFriendly = false,
  dense = false,
}: ShopTagFilterPanelProps) {
  const safeTags = tags ?? []
  const safeSelectedTagIds = selectedTagIds ?? []
  const hasActiveTagFilters = safeSelectedTagIds.length > 0

  if (safeTags.length === 0) return null

  return (
    <aside
      className={cn(
        "rounded-2xl border border-border/50 bg-card/50",
        dense ? "p-4" : "p-5 lg:p-6",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className={cn("font-semibold", touchFriendly ? "text-base" : "text-sm")}>
          Tags
        </h3>
        {hasActiveTagFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("px-2 text-xs", touchFriendly && "h-10 px-3 text-sm")}
            onClick={onClear}
          >
            Tags zurücksetzen
          </Button>
        )}
      </div>

      <div className={cn("space-y-2", touchFriendly && "space-y-3")}>
        <Label className="text-xs text-muted-foreground">Verfeinern</Label>
        <div className={cn("space-y-2", touchFriendly && "space-y-1")}>
          {safeTags.map((tag) => {
            const tagId = tag?.id
            if (!tagId) return null

            return (
            <label
              key={tagId}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-1 text-sm hover:bg-secondary/40",
                touchFriendly ? "min-h-12 gap-3.5 px-2 py-3 text-base" : "py-1.5"
              )}
            >
              <Checkbox
                className={touchFriendly ? "size-5" : undefined}
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
