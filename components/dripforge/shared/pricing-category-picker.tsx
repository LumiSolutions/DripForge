"use client"

import { cn } from "@/lib/utils"
import {
  formatFromPriceChf,
  type IndividualPricingCategory,
} from "@/lib/admin/individual-pricing-types"

type PricingCategoryPickerProps = {
  categories: IndividualPricingCategory[]
  selectedId: string | null
  onSelect: (id: string) => void
  accentClassName?: string
}

export function PricingCategoryPicker({
  categories,
  selectedId,
  onSelect,
  accentClassName = "border-primary bg-primary/10",
}: PricingCategoryPickerProps) {
  return (
    <div className="space-y-2">
      <h3 className="font-bold">Preiskategorie</h3>
      <div className="grid gap-2">
        {categories.map((category) => {
          const selected = selectedId === category.id
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                selected
                  ? accentClassName
                  : "border-border/60 hover:border-primary/40"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{category.label}</p>
                  <p className="text-xs text-muted-foreground">{category.sizeHint}</p>
                </div>
                <p className="shrink-0 text-sm font-bold">
                  {formatFromPriceChf(category.fromPriceChf)}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
