"use client"

import { useEffect, useState } from "react"
import { materials3D } from "@/lib/dripforge/data"
import { legacyMaterialsFallback } from "@/lib/dripforge/filament-catalog"
import {
  buildDefaultMaterialTypes,
  getActiveMaterialTypes,
  typesToLegacyMap,
  type MaterialTypeDefinition,
} from "@/lib/admin/material-stats-types"
import type { FilamentMaterial } from "@/lib/dripforge/types"

export function useFilamentCatalog(): {
  materials: FilamentMaterial[]
  materialTypes: MaterialTypeDefinition[]
  materialStats: ReturnType<typeof typesToLegacyMap>
} {
  const defaults = buildDefaultMaterialTypes()
  const [materialTypes, setMaterialTypes] = useState(defaults)
  const [materials, setMaterials] = useState<FilamentMaterial[]>(() =>
    legacyMaterialsFallback(getActiveMaterialTypes(defaults))
  )
  const [materialStats, setMaterialStats] = useState(() =>
    typesToLegacyMap(getActiveMaterialTypes(defaults))
  )

  useEffect(() => {
    void fetch("/api/filaments", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.materialTypes) && data.materialTypes.length > 0) {
          setMaterialTypes(data.materialTypes as MaterialTypeDefinition[])
        }
        if (Array.isArray(data?.materials) && data.materials.length > 0) {
          setMaterials(data.materials as FilamentMaterial[])
        }
        if (data?.materialStats && typeof data.materialStats === "object") {
          setMaterialStats({ ...typesToLegacyMap(defaults), ...data.materialStats })
        }
      })
      .catch(() => {
        console.warn("Filamente: API-Fallback auf lokale Demo-Daten.")
        const active = getActiveMaterialTypes(defaults)
        setMaterials(legacyMaterialsFallback(active))
        setMaterialTypes(active)
        setMaterialStats(typesToLegacyMap(active))
      })
  }, [])

  return { materials, materialTypes, materialStats }
}

export function useFilamentMaterials(): FilamentMaterial[] {
  return useFilamentCatalog().materials
}
