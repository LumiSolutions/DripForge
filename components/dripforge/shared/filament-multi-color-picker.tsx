"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { CheckCircle2, Plus, Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FilamentMaterial } from "@/lib/dripforge/types"

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
  return primary.colorHex
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
  className?: string
}

export function FilamentMultiColorPicker({
  materials,
  activeTab,
  onTabChange,
  onSelectionChange,
  className,
}: FilamentMultiColorPickerProps) {
  const [activeSlot, setActiveSlot] = useState(1)
  const [primarySlot, setPrimarySlot] = useState(1)
  const [slotIds, setSlotIds] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(materials.map((m) => [m.id, [1]]))
  )
  const [slots, setSlots] = useState<Record<string, MultiColorSlot[]>>(() => {
    const initial: Record<string, MultiColorSlot[]> = {}
    for (const material of materials) {
      const defaultColor =
        material.colors.find((c) => c.inStock) ?? material.colors[0]
      if (defaultColor) {
        initial[material.id] = [
          {
            slot: 1,
            colorId: defaultColor.id,
            colorName: defaultColor.name,
            colorHex: defaultColor.hex,
            inStock: defaultColor.inStock,
          },
        ]
      } else {
        initial[material.id] = []
      }
    }
    return initial
  })

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
      const existingIndex = list.findIndex((c) => c.colorId === color.id)
      const slotEntry: MultiColorSlot = {
        slot: activeSlot,
        colorId: color.id,
        colorName: color.name,
        colorHex: color.hex,
        inStock: color.inStock,
      }

      if (existingIndex >= 0) {
        list[existingIndex] = { ...slotEntry, slot: list[existingIndex].slot }
        return { ...prev, [activeTab]: list }
      }

      const slotIndex = list.findIndex((c) => c.slot === activeSlot)
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
        Waehle beliebig viele AMS-Farben. Klicke «Farbe N», dann eine Kachel —
        Stern markiert die Primaerfarbe.
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
                  ? "border-primary bg-primary/10 text-foreground"
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
                <span>Farbe {slotNum}</span>
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
                    aria-label={`Farbe ${slotNum} als Primaerfarbe`}
                  >
                    <Star
                      className={cn("h-3.5 w-3.5", isPrimary && "fill-current")}
                    />
                  </button>
                  {currentSlotIds.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSlot(slotNum)}
                      className="rounded p-1 text-muted-foreground hover:text-red-500"
                      aria-label={`Farbe ${slotNum} entfernen`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
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
        {primaryColor && (
          <span className="w-full text-xs text-muted-foreground sm:w-auto sm:ml-0">
            Primaer: {primaryColor.colorName}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
          <div className="relative mx-auto h-32 w-full max-w-[200px]">
            {primaryColor ? (
              <div
                className="absolute inset-4 rounded-xl border border-border/40 shadow-inner"
                style={{ backgroundColor: primaryColor.colorHex }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Keine Farbe gewaehlt
              </div>
            )}
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
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {(currentMaterial?.colors ?? []).map((color) => {
              const inSelection = currentSlots?.some((c) => c.colorId === color.id)
              return (
                <button
                  key={color.id}
                  type="button"
                  disabled={!color.inStock}
                  onClick={() => assignColor(color)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-all",
                    inSelection
                      ? "border-primary bg-primary/10"
                      : "border-border/50 hover:border-primary/40",
                    !color.inStock && "cursor-not-allowed opacity-40"
                  )}
                >
                  {color.image ? (
                    <div className="relative h-9 w-9">
                      <Image
                        src={color.image}
                        alt={color.name}
                        fill
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      className="h-9 w-9 rounded-full border border-border/50"
                      style={{ backgroundColor: color.hex }}
                    />
                  )}
                  <span className="text-[10px] leading-tight text-muted-foreground">
                    {color.name.length > 7
                      ? `${color.name.slice(0, 6)}.`
                      : color.name}
                  </span>
                  {inSelection && (
                    <CheckCircle2 className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 text-primary" />
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
