"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Plus, Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FilamentMaterial } from "@/lib/dripforge/types"
import {
  FILAMENT_SWATCH_GRID_CLASS,
  FILAMENT_SWATCH_LABEL_CLASS,
  FILAMENT_SWATCH_TILE_CLASS,
} from "@/components/dripforge/shared/filament-swatch-grid"

export type MultiColorSlot = {
  slot: number
  colorId: string
  colorName: string
  colorHex: string
  inStock: boolean
}

export type FilamentMultiColorSelection = {
  materialId: string
  materialName: string
  colors: MultiColorSlot[]
  primarySlot: number
}

export function getPrimaryColorHex(
  selection: FilamentMultiColorSelection | null
): string {
  if (!selection || selection.colors.length === 0) return "#1a1a1a"
  const primary =
    selection.colors.find((c) => c.slot === selection.primarySlot) ??
    selection.colors[0]
  const hex = primary?.colorHex?.trim()
  return hex || "#1a1a1a"
}

export function assignColorsToMeshParts(
  partCount: number,
  selection: FilamentMultiColorSelection | null,
  preserveOriginalColors: boolean,
  partsUseOriginalMaterial?: boolean[]
): string[] {
  const primary = getPrimaryColorHex(selection)
  if (preserveOriginalColors) {
    return Array.from({ length: Math.max(1, partCount) }, () => primary)
  }

  if (!selection || selection.colors.length === 0) {
    return Array.from({ length: Math.max(1, partCount) }, () => primary)
  }

  const ordered = [...selection.colors].sort((a, b) => a.slot - b.slot)
  const hexes = ordered.map((c) => c.colorHex)

  return Array.from({ length: partCount }, (_, index) => {
    if (partsUseOriginalMaterial?.[index]) return primary
    if (index < hexes.length) return hexes[index]
    return primary
  })
}

type FilamentMultiColorPickerProps = {
  materials: FilamentMaterial[]
  activeTab: string
  onTabChange: (id: string) => void
  onSelectionChange?: (selection: FilamentMultiColorSelection) => void
  /** Teil-Bezeichnungen aus dem Admin (z. B. Rücken, Körper, Pfoten) */
  slotLabels?: string[]
  className?: string
  /** Wenn true: keine «Farbe hinzufügen»-Slots über die Labels hinaus */
  lockSlotCountToLabels?: boolean
}

function buildInitialSlotIds(
  materials: FilamentMaterial[],
  labelCount: number
): Record<string, number[]> {
  const count = Math.max(1, labelCount)
  const ids = Array.from({ length: count }, (_, i) => i + 1)
  return Object.fromEntries(materials.map((m) => [m.id, [...ids]]))
}

function buildInitialSlots(
  materials: FilamentMaterial[],
  labelCount: number
): Record<string, MultiColorSlot[]> {
  const count = Math.max(1, labelCount)
  const initial: Record<string, MultiColorSlot[]> = {}
  for (const material of materials) {
    const defaultColor =
      material.colors.find((c) => c.inStock) ?? material.colors[0]
    if (!defaultColor) {
      initial[material.id] = []
      continue
    }
    initial[material.id] = Array.from({ length: count }, (_, i) => ({
      slot: i + 1,
      colorId: defaultColor.id,
      colorName: defaultColor.name,
      colorHex: defaultColor.hex,
      inStock: defaultColor.inStock,
    }))
  }
  return initial
}

export function FilamentMultiColorPicker({
  materials,
  activeTab,
  onTabChange,
  onSelectionChange,
  slotLabels = [],
  className,
  lockSlotCountToLabels = false,
}: FilamentMultiColorPickerProps) {
  const labelCount = slotLabels.filter((l) => l.trim()).length
  const [activeSlot, setActiveSlot] = useState(1)
  const [primarySlot, setPrimarySlot] = useState(1)
  const [slotIds, setSlotIds] = useState<Record<string, number[]>>(() =>
    buildInitialSlotIds(materials, labelCount)
  )
  const [slots, setSlots] = useState<Record<string, MultiColorSlot[]>>(() =>
    buildInitialSlots(materials, labelCount)
  )

  // Wenn Admin Teil-Labels setzt/ändert: Slots anpassen (ohne bestehende Farben zu verwerfen)
  useEffect(() => {
    if (labelCount <= 0) return
    setSlotIds((prev) => {
      const next = { ...prev }
      for (const material of materials) {
        const current = next[material.id] ?? [1]
        if (current.length < labelCount) {
          const extras = Array.from(
            { length: labelCount - current.length },
            (_, i) => (current[current.length - 1] ?? 0) + i + 1
          )
          next[material.id] = [...current, ...extras]
        } else if (lockSlotCountToLabels && current.length > labelCount) {
          next[material.id] = current.slice(0, labelCount)
        }
      }
      return next
    })
    setSlots((prev) => {
      const next = { ...prev }
      for (const material of materials) {
        const defaultColor =
          material.colors.find((c) => c.inStock) ?? material.colors[0]
        if (!defaultColor) continue
        const list = [...(next[material.id] ?? [])]
        while (list.length < labelCount) {
          const slot = list.length + 1
          list.push({
            slot,
            colorId: defaultColor.id,
            colorName: defaultColor.name,
            colorHex: defaultColor.hex,
            inStock: defaultColor.inStock,
          })
        }
        if (lockSlotCountToLabels && list.length > labelCount) {
          next[material.id] = list.slice(0, labelCount)
        } else {
          next[material.id] = list
        }
      }
      return next
    })
  }, [labelCount, lockSlotCountToLabels, materials])

  const currentMaterial = materials.find((m) => m.id === activeTab)
  const currentSlots = slots[activeTab] ?? []
  const currentSlotIds = slotIds[activeTab] ?? [1]

  const selection = useMemo((): FilamentMultiColorSelection | null => {
    if (!currentMaterial || currentSlots.length === 0) return null
    const validPrimary = currentSlots.some((c) => c.slot === primarySlot)
      ? primarySlot
      : currentSlots[0].slot
    return {
      materialId: currentMaterial.id,
      materialName: currentMaterial.name,
      colors: currentSlots,
      primarySlot: validPrimary,
    }
  }, [currentMaterial, currentSlots, primarySlot])

  useEffect(() => {
    if (selection && onSelectionChange) {
      onSelectionChange(selection)
    }
  }, [selection, onSelectionChange])

  const assignColor = (color: { id: string; name: string; hex: string; inStock: boolean }) => {
    if (!color.inStock || !currentMaterial) return

    setSlots((prev) => {
      const list = [...(prev[activeTab] ?? [])]
      const slotIndex = list.findIndex((c) => c.slot === activeSlot)

      // Deselect nur für das aktive Teil — andere Teile behalten ihre Farbe
      if (slotIndex >= 0 && list[slotIndex].colorId === color.id) {
        list.splice(slotIndex, 1)
        return { ...prev, [activeTab]: list }
      }

      const slotEntry: MultiColorSlot = {
        slot: activeSlot,
        colorId: color.id,
        colorName: color.name,
        colorHex: color.hex,
        inStock: color.inStock,
      }

      // Gleiche colorId darf auf mehreren Teilen gleichzeitig liegen
      if (slotIndex >= 0) {
        list[slotIndex] = slotEntry
      } else {
        list.push(slotEntry)
        list.sort((a, b) => a.slot - b.slot)
      }

      return { ...prev, [activeTab]: list }
    })
  }

  const removeSlot = (slot: number) => {
    if (currentSlotIds.length <= 1) return

    setSlots((prev) => {
      const list = (prev[activeTab] ?? []).filter((c) => c.slot !== slot)
      return { ...prev, [activeTab]: list }
    })
    setSlotIds((prev) => ({
      ...prev,
      [activeTab]: (prev[activeTab] ?? [1]).filter((id) => id !== slot),
    }))
    if (primarySlot === slot) setPrimarySlot(1)
    if (activeSlot === slot) setActiveSlot(1)
  }

  const addColorSlot = () => {
    const nextId = Math.max(...currentSlotIds, 0) + 1
    setSlotIds((prev) => ({
      ...prev,
      [activeTab]: [...(prev[activeTab] ?? [1]), nextId],
    }))
    setActiveSlot(nextId)
  }

  const primaryColor = currentSlots.find((c) => c.slot === primarySlot)

  return (
    <div className={cn("space-y-5", className)}>
      <p className="text-sm text-muted-foreground">
        {labelCount > 0
          ? "Weise jedem Teil eine Filamentfarbe zu. Stern markiert die Primaerfarbe."
          : "Waehle beliebig viele AMS-Farben. Klicke «Farbe N», dann eine Kachel — Stern markiert die Primaerfarbe."}
      </p>

      <div className="flex justify-center">
        <div className="inline-flex rounded-xl bg-secondary p-1">
          {materials.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onTabChange(m.id)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                activeTab === m.id
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/20 p-3">
        <span className="w-full text-xs font-medium text-muted-foreground sm:w-auto">
          Aktive Auswahl:
        </span>
        {currentSlotIds.map((slotNum) => {
          const entry = currentSlots.find((c) => c.slot === slotNum)
          const isActive = activeSlot === slotNum
          const isPrimary = primarySlot === slotNum && entry

          return (
            <div
              key={slotNum}
              className={cn(
                "flex items-center gap-1 rounded-lg border pr-1 text-xs font-medium transition-all",
                isActive
                  ? "border-primary bg-primary/15 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.45)] ring-2 ring-primary/35"
                  : entry
                    ? "border-primary/35 bg-card/80 text-foreground"
                    : "border-border/60 bg-card/80 text-muted-foreground"
              )}
            >
              <button
                type="button"
                onClick={() => setActiveSlot(slotNum)}
                className="flex flex-1 items-center gap-2 px-2.5 py-1.5 hover:opacity-90"
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full border border-border/50"
                  style={{
                    backgroundColor: entry?.colorHex ?? "transparent",
                  }}
                />
                <span>
                  {slotLabels[slotNum - 1]?.trim() || `Farbe ${slotNum}`}
                </span>
              </button>
              {entry && (
                <>
                  <button
                    type="button"
                    onClick={() => setPrimarySlot(slotNum)}
                    className={cn(
                      "rounded p-1",
                      isPrimary
                        ? "text-amber-500"
                        : "text-muted-foreground hover:text-amber-500"
                    )}
                    title="Als Primaerfarbe setzen"
                    aria-label={`${slotLabels[slotNum - 1]?.trim() || `Farbe ${slotNum}`} als Primaerfarbe`}
                  >
                    <Star
                      className={cn("h-3.5 w-3.5", isPrimary && "fill-current")}
                    />
                  </button>
                  {currentSlotIds.length > 1 &&
                    !(lockSlotCountToLabels && labelCount > 0) && (
                    <button
                      type="button"
                      onClick={() => removeSlot(slotNum)}
                      className="rounded p-1 text-muted-foreground hover:text-red-500"
                      aria-label={`${slotLabels[slotNum - 1]?.trim() || `Farbe ${slotNum}`} entfernen`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
        {!(lockSlotCountToLabels && labelCount > 0) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addColorSlot}
            className="ml-auto h-8 gap-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Farbe hinzufuegen
          </Button>
        )}
        {primaryColor && (
          <span className="w-full text-xs text-muted-foreground sm:w-auto sm:ml-0">
            Primaer: {primaryColor.colorName}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
          <div className="relative mx-auto h-36 w-full max-w-[200px]">
            {(() => {
              const previewColor =
                currentMaterial?.colors.find((c) => c.id === primaryColor?.colorId) ??
                null
              const previewSrc =
                previewColor?.printedExample ?? previewColor?.image ?? null
              if (previewSrc) {
                return (
                  <Image
                    key={previewSrc}
                    src={previewSrc}
                    alt={`${primaryColor?.colorName ?? "Filament"} Vorschaubild`}
                    fill
                    sizes="200px"
                    quality={55}
                    loading="lazy"
                    className="object-contain drop-shadow-2xl transition-opacity duration-300"
                  />
                )
              }
              if (primaryColor) {
                return (
                  <div
                    className="absolute inset-4 rounded-xl border border-border/40 shadow-inner"
                    style={{ backgroundColor: primaryColor.colorHex || "#1a1a1a" }}
                  />
                )
              }
              return (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Keine Farbe gewaehlt
                </div>
              )
            })()}
          </div>
          <p className="mt-3 text-center text-sm font-bold">
            {primaryColor?.colorName ?? "—"}
          </p>
          <p className="text-center text-xs text-muted-foreground">
            {currentMaterial?.name ?? "Lädt..."} · {currentSlots?.length ?? 0} Farbe
            {(currentSlots?.length ?? 0) === 1 ? "" : "n"} gewaehlt
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            {currentMaterial?.colors?.filter((c) => c.inStock).length ?? 0} Farben auf
            Lager
          </p>
          <div className={FILAMENT_SWATCH_GRID_CLASS}>
            {(currentMaterial?.colors ?? []).map((color) => {
              const onActiveSlot = currentSlots?.some(
                (c) => c.slot === activeSlot && c.colorId === color.id
              )
              const usedOnAnyPart = currentSlots?.some((c) => c.colorId === color.id)
              return (
                <button
                  key={color.id}
                  type="button"
                  disabled={!color.inStock}
                  onClick={() => assignColor(color)}
                  className={cn(
                    FILAMENT_SWATCH_TILE_CLASS,
                    onActiveSlot || usedOnAnyPart
                      ? "border-primary bg-primary/10"
                      : "border-border/50 hover:border-primary/40",
                    !color.inStock && "cursor-not-allowed opacity-40"
                  )}
                >
                  {(color.printedExample ?? color.image) ? (
                    <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
                      <Image
                        src={(color.printedExample ?? color.image)!}
                        alt={color.name}
                        fill
                        sizes="64px"
                        quality={40}
                        loading="lazy"
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      className="h-14 w-14 shrink-0 rounded-full border border-border/50 sm:h-16 sm:w-16"
                      style={{ backgroundColor: color.hex || "#1a1a1a" }}
                    />
                  )}
                  <span className={cn(FILAMENT_SWATCH_LABEL_CLASS, "text-muted-foreground")}>
                    {color.name}
                  </span>
                  {onActiveSlot && (
                    <span
                      className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
                      title="Klicken zum Abwählen für dieses Teil"
                      aria-hidden
                    >
                      <X className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
