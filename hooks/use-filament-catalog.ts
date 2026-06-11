"use client"

import { useEffect, useState } from "react"
import { materials3D } from "@/lib/dripforge/data"
import { legacyMaterialsFallback } from "@/lib/dripforge/filament-catalog"
import {
  buildDefaultMaterialStats,
  type MaterialStatsMap,
} from "@/lib/admin/material-stats-types"
import type { FilamentMaterial } from "@/lib/dripforge/types"

export function useFilamentCatalog(): {
  materials: FilamentMaterial[]
  materialStats: MaterialStatsMap
} {
  const defaults = buildDefaultMaterialStats()
  const [materials, setMaterials] = useState<FilamentMaterial[]>(() =>
    legacyMaterialsFallback(defaults)
  )
  const [materialStats, setMaterialStats] = useState<MaterialStatsMap>(defaults)

  useEffect(() => {
    void fetch("/api/filaments", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.materials) && data.materials.length > 0) {
          setMaterials(data.materials as FilamentMaterial[])
        }
        if (data?.materialStats && typeof data.materialStats === "object") {
          setMaterialStats({ ...defaults, ...data.materialStats })
        }
      })
      .catch(() => {
        console.warn("Filamente: API-Fallback auf lokale Demo-Daten.")
        setMaterials(legacyMaterialsFallback(defaults))
        setMaterialStats(defaults)
      })
  }, [])

  return { materials, materialStats }
}

export function useFilamentMaterials(): FilamentMaterial[] {
  return useFilamentCatalog().materials
}
