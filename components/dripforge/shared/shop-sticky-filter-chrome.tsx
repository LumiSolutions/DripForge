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

/**
 * Sticky unter Header; z-40 über Produkt-Raster, unter Select-Portal (z-[110]).
 * WICHTIG: Der fixe Header ist zusätzlich um die Banner-Höhe (--df-banner-h) nach
 * unten versetzt. Ohne diesen Offset dockte die Filterleiste zu hoch an und
 * verschwand hinter dem Header — Produktinhalte schienen darunter "durch".
 */
const stickyBarClass =
  "sticky top-[calc(var(--df-banner-h,0px)+var(--header-height,4rem))] z-40 isolate border-b border-border/40 bg-background shadow-sm supports-[backdrop-filter]:bg-background/95 supports-[backdrop-filter]:backdrop-blur"

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
      {/* Desktop: volle Sticky-Leiste unter dem Header */}
      <div
        className={cn(
          stickyBarClass,
          "mt-2 hidden space-y-4 py-5 lg:block"
        )}
      >
        <ShopMainFilterTabs
          options={mainFilterOptions}
          activeId={categoryFilter}
          onChange={onCategoryChange}
        />
        <div className="flex flex-col gap-4 border-t border-border/50 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            {productCount} Produkt{productCount === 1 ? "" : "e"}
          </p>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {viewToggle}
            <ArrowUpDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
            <Select
              value={sortMode}
              onValueChange={(value) => onSortChange(value as ShopSortMode)}
            >
              <SelectTrigger className="w-full min-w-[180px] sm:w-[220px]">
                <SelectValue placeholder="Sortieren" />
              </SelectTrigger>
              {/* Über sticky Filter (40) und Header (100) */}
              <SelectContent className="z-[110]" position="popper" sideOffset={6}>
                <SelectItem value="price-asc">Preis: aufsteigend</SelectItem>
                <SelectItem value="price-desc">Preis: absteigend</SelectItem>
                <SelectItem value="popular">Beliebtheit</SelectItem>
                <SelectItem value="newest">Neueste zuerst</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Mobile: Icon-Bar — sticky unter dem Header */}
      <div
        className={cn(
          stickyBarClass,
          "-mx-4 mt-3 flex items-center justify-between gap-2 border-t border-border/50 px-4 pb-3 pt-5 lg:hidden"
        )}
      >
        <p className="truncate text-xs font-medium text-muted-foreground">
          {productCount} Produkt{productCount === 1 ? "" : "e"}
        </p>
        <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/90 p-1 shadow-sm">
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
        <SheetContent
          side="bottom"
          overlayClassName="z-[120] bg-black/55 backdrop-blur-sm"
          className="z-[121] max-h-[80vh] gap-0 overflow-y-auto rounded-t-2xl px-6 pb-8 pt-2"
        >
          <SheetHeader className="space-y-1 p-0 pb-2 pr-10 pt-4 text-left">
            <SheetTitle className="text-lg">
              {sheet === "category" && "Kategorie"}
              {sheet === "tags" && "Tags"}
              {sheet === "sort" && "Sortierung"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 pb-4">
            {sheet === "category" ? (
              <div className="flex flex-col gap-3">
                {mainFilterOptions.map((option) => {
                  const active = categoryFilter === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        "flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-base font-medium",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/60 bg-card/40 text-muted-foreground"
                      )}
                      onClick={() => {
                        onCategoryChange(option.id)
                        setSheet(null)
                      }}
                    >
                      {option.id === "3d" && <Printer className="h-5 w-5" />}
                      {option.id === "laser" && <Zap className="h-5 w-5" />}
                      {option.id === "sale" && <Percent className="h-5 w-5" />}
                      {option.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
            {sheet === "tags" ? (
              <ShopTagFilterPanel
                className="border-0 bg-transparent p-0"
                dense={false}
                touchFriendly
                tags={visibleProductTags}
                selectedTagIds={selectedTagIds}
                onToggleTag={onToggleTag}
                onClear={onClearTags}
              />
            ) : null}
            {sheet === "sort" ? (
              <div className="flex flex-col gap-3">
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
                      "min-h-12 rounded-xl border px-4 py-3.5 text-left text-base font-medium",
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
