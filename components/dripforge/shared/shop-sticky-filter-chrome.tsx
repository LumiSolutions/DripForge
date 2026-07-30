"use client"

import { useState } from "react"
import {
  ArrowUpDown,
  Filter,
  Percent,
  Printer,
  Tags,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ShopMainFilterTabs } from "@/components/dripforge/shared/shop-main-filter-tabs"
import { ShopTagFilterPanel } from "@/components/dripforge/shared/shop-tag-filter-panel"
import type { ShopFilterId, ShopFilterOption } from "@/lib/dripforge/shop-filters"
import type { ProductTag } from "@/lib/admin/product-tags"
import { cn } from "@/lib/utils"

type ShopSortMode = "price-asc" | "price-desc" | "newest" | "popular"

type ShopStickyFilterChromeProps = {
  mainFilterOptions: ShopFilterOption[]
  categoryFilter: ShopFilterId
  onCategoryChange: (id: ShopFilterId) => void
  visibleProductTags: ProductTag[]
  selectedTagIds: string[]
  onToggleTag: (tagId: string, checked: boolean) => void
  onClearTags: () => void
  sortMode: ShopSortMode
  onSortChange: (mode: ShopSortMode) => void
  productCount: number
  viewToggle: React.ReactNode
}

export function ShopStickyFilterChrome({
  mainFilterOptions,
  categoryFilter,
  onCategoryChange,
  visibleProductTags,
  selectedTagIds,
  onToggleTag,
  onClearTags,
  sortMode,
  onSortChange,
  productCount,
  viewToggle,
}: ShopStickyFilterChromeProps) {
  const [sheet, setSheet] = useState<"category" | "tags" | "sort" | null>(null)

  return (
    <>
      {/* Desktop: volle Sticky-Leiste */}
      <div className="sticky top-20 z-30 hidden space-y-4 border-b border-border/40 bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:block">
        <ShopMainFilterTabs
          options={mainFilterOptions}
          activeId={categoryFilter}
          onChange={onCategoryChange}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {productCount} Produkt{productCount === 1 ? "" : "e"}
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {viewToggle}
            <ArrowUpDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
            <Select
              value={sortMode}
              onValueChange={(value) => onSortChange(value as ShopSortMode)}
            >
              <SelectTrigger className="w-full min-w-[180px] sm:w-[220px]">
                <SelectValue placeholder="Sortieren" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price-asc">Preis: aufsteigend</SelectItem>
                <SelectItem value="price-desc">Preis: absteigend</SelectItem>
                <SelectItem value="popular">Beliebtheit</SelectItem>
                <SelectItem value="newest">Neueste zuerst</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Mobile: kompakte Icon-Bar — immer am oberen Viewport-Rand */}
      <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-2 border-b border-border/40 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/90 lg:hidden">
        <p className="truncate text-xs text-muted-foreground">
          {productCount} Produkt{productCount === 1 ? "" : "e"}
        </p>
        <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/80 p-1 shadow-sm">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full"
            aria-label="Kategorie"
            onClick={() => setSheet("category")}
          >
            <Filter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full"
            aria-label="Tags"
            disabled={visibleProductTags.length === 0}
            onClick={() => setSheet("tags")}
          >
            <Tags className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full"
            aria-label="Sortieren"
            onClick={() => setSheet("sort")}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          {viewToggle}
        </div>
      </div>

      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) setSheet(null)
        }}
      >
        <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>
              {sheet === "category" && "Kategorie"}
              {sheet === "tags" && "Tags"}
              {sheet === "sort" && "Sortierung"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            {sheet === "category" ? (
              <div className="flex flex-col gap-2">
                {mainFilterOptions.map((option) => {
                  const active = categoryFilter === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-medium",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 bg-card/40 text-muted-foreground"
                      )}
                      onClick={() => {
                        onCategoryChange(option.id)
                        setSheet(null)
                      }}
                    >
                      {option.id === "3d" && <Printer className="h-4 w-4" />}
                      {option.id === "laser" && <Zap className="h-4 w-4" />}
                      {option.id === "sale" && <Percent className="h-4 w-4" />}
                      {option.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
            {sheet === "tags" ? (
              <ShopTagFilterPanel
                className="border-0 bg-transparent p-0"
                tags={visibleProductTags}
                selectedTagIds={selectedTagIds}
                onToggleTag={onToggleTag}
                onClear={onClearTags}
              />
            ) : null}
            {sheet === "sort" ? (
              <div className="flex flex-col gap-2">
                {(
                  [
                    ["price-asc", "Preis: aufsteigend"],
                    ["price-desc", "Preis: absteigend"],
                    ["popular", "Beliebtheit"],
                    ["newest", "Neueste zuerst"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left text-sm font-medium",
                      sortMode === value
                        ? "border-primary bg-primary/10"
                        : "border-border/60 bg-card/40 text-muted-foreground"
                    )}
                    onClick={() => {
                      onSortChange(value)
                      setSheet(null)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
