"use client"

import { useEffect, useState } from "react"
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
  loading: boolean
} {
  const defaults = buildDefaultMaterialTypes()
  const [materialTypes, setMaterialTypes] = useState(defaults)
  const [materials, setMaterials] = useState<FilamentMaterial[]>([])
  const [materialStats, setMaterialStats] = useState(() =>
    typesToLegacyMap(getActiveMaterialTypes(defaults))
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void fetch("/api/filaments", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || data == null) return

        if (Array.isArray(data.materialTypes) && data.materialTypes.length > 0) {
          setMaterialTypes(data.materialTypes as MaterialTypeDefinition[])
        }
        if (Array.isArray(data.materials)) {
          setMaterials(data.materials as FilamentMaterial[])
        }
        if (data.materialStats && typeof data.materialStats === "object") {
          setMaterialStats({ ...typesToLegacyMap(defaults), ...data.materialStats })
        }
      })
      .catch(() => {
        if (cancelled) return
        console.warn("Filamente: API nicht erreichbar — keine Farben angezeigt.")
        setMaterials([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { materials, materialTypes, materialStats, loading }
}

export function useFilamentMaterials(): FilamentMaterial[] {
  return useFilamentCatalog().materials
}
