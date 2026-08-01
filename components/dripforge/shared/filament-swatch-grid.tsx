import { cn } from "@/lib/utils"

/**
 * Horizontale, umbrechende Badge-/Kachel-Liste.
 * minmax(110px) verhindert gequetschte vertikale Buchstaben-Stacks.
 */
export const FILAMENT_SWATCH_GRID_CLASS =
  "flex w-full flex-wrap gap-3"

export const FILAMENT_SWATCH_TILE_CLASS =
  "relative flex min-h-[6.5rem] w-[calc(50%-0.375rem)] min-w-[110px] max-w-[140px] flex-col items-center justify-start gap-2 rounded-xl border p-3 text-center transition-all duration-200 sm:w-[120px] sm:max-w-none"

export const FILAMENT_SWATCH_LABEL_CLASS =
  "w-full max-w-full whitespace-normal break-normal text-center text-xs font-medium leading-snug [writing-mode:horizontal-tb] [text-orientation:mixed] sm:text-sm"

export function filamentSwatchGridClassName(className?: string) {
  return cn(FILAMENT_SWATCH_GRID_CLASS, className)
}
