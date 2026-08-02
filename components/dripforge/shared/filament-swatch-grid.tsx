import { cn } from "@/lib/utils"

/**
 * Filament-Farbwahl: Mobile 3 Spalten, Desktop 4 Spalten.
 */
export const FILAMENT_SWATCH_GRID_CLASS =
  "grid w-full grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-4"

export const FILAMENT_SWATCH_TILE_CLASS =
  "relative flex min-h-[6.5rem] w-full min-w-0 flex-col items-center justify-start gap-2 rounded-xl border p-2 text-center transition-all duration-200 sm:min-h-[6.5rem] sm:p-3"

export const FILAMENT_SWATCH_LABEL_CLASS =
  "w-full max-w-full whitespace-normal break-normal text-center text-[11px] font-medium leading-snug [writing-mode:horizontal-tb] [text-orientation:mixed] sm:text-xs"

export function filamentSwatchGridClassName(className?: string) {
  return cn(FILAMENT_SWATCH_GRID_CLASS, className)
}
