import { cn } from "@/lib/utils"

/** Shared tile grid: never squeezes labels into vertical letter stacks. */
export const FILAMENT_SWATCH_GRID_CLASS =
  "grid w-full gap-3 [grid-template-columns:repeat(auto-fill,minmax(110px,1fr))]"

export const FILAMENT_SWATCH_TILE_CLASS =
  "relative flex min-h-[7.5rem] min-w-[110px] flex-col items-center justify-start gap-2 rounded-xl border p-3 text-center transition-all duration-200"

export const FILAMENT_SWATCH_LABEL_CLASS =
  "w-full max-w-full whitespace-normal break-normal text-center text-xs font-medium leading-snug [writing-mode:horizontal-tb] [text-orientation:mixed] sm:text-sm"

export function filamentSwatchGridClassName(className?: string) {
  return cn(FILAMENT_SWATCH_GRID_CLASS, className)
}
