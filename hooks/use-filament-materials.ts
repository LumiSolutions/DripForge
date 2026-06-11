"use client"

import { useEffect, useState } from "react"
import { materials3D } from "@/lib/dripforge/data"
import { legacyMaterialsFallback } from "@/lib/dripforge/filament-catalog"
import type { FilamentMaterial } from "@/lib/dripforge/types"

export function useFilamentMaterials(): FilamentMaterial[] {
  const [materials, setMaterials] = useState<FilamentMaterial[]>(() =>
    legacyMaterialsFallback()
  )

  useEffect(() => {
    void fetch("/api/filaments", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.materials) && data.materials.length > 0) {
          setMaterials(data.materials as FilamentMaterial[])
        }
      })
      .catch(() => {
        console.warn("Filamente: API-Fallback auf lokale Demo-Daten.")
        setMaterials(
          materials3D.map((material) => ({
            id: material.id,
            name: material.name,
            colors: material.colors.map((color) => ({
              id: color.id,
              name: color.name,
              hex: color.hex,
              inStock: color.inStock,
              image: color.image,
              printedExample: color.printedExample ?? null,
            })),
          }))
        )
      })
  }, [])

  return materials
}
