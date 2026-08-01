"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { CheckCircle2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FilamentMaterial } from "@/lib/dripforge/types"
import { FilamentStatsPanel } from "@/components/dripforge/shared/filament-stats-panel"
import {
  FILAMENT_SWATCH_GRID_CLASS,
  FILAMENT_SWATCH_LABEL_CLASS,
  FILAMENT_SWATCH_TILE_CLASS,
} from "@/components/dripforge/shared/filament-swatch-grid"

export type FilamentSelection = {
  materialId: string
  materialName: string
  colorId: string
  colorName: string
  colorHex: string
  inStock: boolean
}

export function pickDefaultFilamentSelection(
  materials: FilamentMaterial[]
): FilamentSelection | null {
  for (const material of materials) {
    const color =
      material.colors.find((entry) => entry.inStock) ?? material.colors[0]
    if (!color) continue

    return {
      materialId: material.id,
      materialName: material.name,
      colorId: color.id,
      colorName: color.name,
      colorHex: color.hex,
      inStock: color.inStock,
    }
  }

  return null
}

function FilamentImageSlot({
  src,
  alt,
}: {
  src?: string | null
  alt: string
}) {
  return (
    <div className="relative h-36 w-full">
      {src ? (
        <Image
          key={src}
          src={src}
          alt={alt}
          fill
          className="object-contain drop-shadow-2xl transition-opacity duration-300"
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/30">
          <span className="text-xs text-muted-foreground">Kein Bild</span>
        </div>
      )}
    </div>
  )
}

export function FilamentColorPicker({
  materials,
  activeTab,
  onTabChange,
  onSelectionChange,
  className,
}: {
  materials: FilamentMaterial[]
  activeTab: string
  onTabChange: (id: string) => void
  onSelectionChange?: (selection: FilamentSelection) => void
  className?: string
}) {
  // Independent selected color per material
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>(() =>
    Object.fromEntries(materials.map((m) => [m.id, m.colors.find((c) => c.inStock)?.id ?? ""]))
  )

  const currentMaterial = materials.find((m) => m.id === activeTab)
  const selectedColor = currentMaterial?.colors.find((c) => c.id === selectedColors[activeTab])

  useEffect(() => {
    if (materials.length === 0) return
    setSelectedColors(
      Object.fromEntries(
        materials.map((m) => [
          m.id,
          m.colors.find((c) => c.inStock)?.id ?? m.colors[0]?.id ?? "",
        ])
      )
    )
  }, [materials])

  useEffect(() => {
    if (!onSelectionChange || !currentMaterial || !selectedColor) return
    onSelectionChange({
      materialId: currentMaterial.id,
      materialName: currentMaterial.name,
      colorId: selectedColor.id,
      colorName: selectedColor.name,
      colorHex: selectedColor.hex,
      inStock: selectedColor.inStock,
    })
  }, [activeTab, selectedColors, currentMaterial, selectedColor, onSelectionChange])

  if (materials.length === 0) {
    return (
      <div className={cn("border-t border-border/50 pt-12", className ?? "mt-16")}>
        <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Aktuell sind keine Filament-Farben hinterlegt.
          </p>
        </div>
      </div>
    )
  }

  if (!currentMaterial) {
    return null
  }

  return (
    <div className={cn("border-t border-border/50 pt-12", className ?? "mt-16")}>
      <div className="mb-8 text-center">
        <h3 className="text-2xl font-bold">Filament Farbauswahl</h3>
        <p className="mt-2 text-sm text-muted-foreground">Wählen Sie Material und Farbe — jede Option ist unabhängig voneinander</p>
      </div>

      {/* Material tabs */}
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-xl bg-secondary p-1">
          {materials.map((m) => (
            <button
              key={m.id}
              onClick={() => onTabChange(m.id)}
              className={cn(
                "rounded-lg px-5 py-2 text-sm font-medium transition-all duration-200",
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

      {/* Vorschau oben, Swatch-Grid darunter — verhindert gequetschte Spalten im Shop-Sidebar */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col rounded-2xl border border-border/50 bg-card/50 p-4">
          <div className="flex flex-1 flex-col items-center">
            <FilamentImageSlot
              src={selectedColor?.printedExample ?? selectedColor?.image}
              alt={`${selectedColor?.name ?? "Filament"} Beispiel-Druck`}
            />
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{currentMaterial.name}</p>
              <p className="truncate text-base font-bold">
                {selectedColor?.displayName ?? selectedColor?.name ?? "—"}
              </p>
            </div>
            <span className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              selectedColor?.inStock ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}>
              {selectedColor?.inStock ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {selectedColor?.inStock ? "Auf Lager" : "Nicht verfügbar"}
            </span>
          </div>
          <FilamentStatsPanel color={selectedColor} />
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/50 p-4 sm:p-6">
          <p className="mb-4 text-sm font-medium text-muted-foreground">
            {currentMaterial.colors.filter((c) => c.inStock).length} von {currentMaterial.colors.length} Farben verfügbar
          </p>
          <div className={FILAMENT_SWATCH_GRID_CLASS}>
            {currentMaterial.colors.map((color) => {
              const isSelected = selectedColors[activeTab] === color.id
              return (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => color.inStock && setSelectedColors((prev) => ({ ...prev, [activeTab]: color.id }))}
                  disabled={!color.inStock}
                  className={cn(
                    FILAMENT_SWATCH_TILE_CLASS,
                    "group",
                    isSelected ? "border-primary bg-primary/10 shadow-md shadow-primary/20" : "border-border/50 bg-card/50 hover:border-primary/40 hover:bg-secondary/50",
                    !color.inStock && "cursor-not-allowed opacity-40"
                  )}
                >
                  {(color.printedExample ?? color.image) ? (
                    <div className="relative h-14 w-14 shrink-0 sm:h-16 sm:w-16">
                      <Image
                        src={(color.printedExample ?? color.image)!}
                        alt={color.name}
                        fill
                        className="object-contain transition-transform duration-200 group-hover:scale-110"
                      />
                    </div>
                  ) : (
                    <div
                      className="h-14 w-14 shrink-0 rounded-full border border-border/50 transition-transform duration-200 group-hover:scale-110 sm:h-16 sm:w-16"
                      style={{ backgroundColor: color.hex || "#1a1a1a" }}
                    />
                  )}
                  <span
                    className={cn(
                      FILAMENT_SWATCH_LABEL_CLASS,
                      isSelected ? "font-semibold text-primary" : "text-muted-foreground"
                    )}
                  >
                    {color.name}
                  </span>
                  {isSelected && (
                    <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary">
                      <CheckCircle2 className="h-2 w-2 text-primary-foreground" />
                    </span>
                  )}
                  {!color.inStock && (
                    <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/40">
                      <X className="h-3 w-3 text-muted-foreground" />
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
