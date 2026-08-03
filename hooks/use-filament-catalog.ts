"use client"

import { useEffect, useState } from "react"
import {
  buildDefaultMaterialTypes,
  getActiveMaterialTypes,
  typesToLegacyMap,
  type MaterialTypeDefinition,
} from "@/lib/admin/material-stats-types"
import { legacyMaterialsFallback } from "@/lib/dripforge/filament-catalog"
import type { FilamentMaterial } from "@/lib/dripforge/types"

function resolveClientMaterials(
  rawMaterials: unknown,
  materialTypes: MaterialTypeDefinition[]
): FilamentMaterial[] {
  if (Array.isArray(rawMaterials) && rawMaterials.length > 0) {
    return rawMaterials as FilamentMaterial[]
  }
  return legacyMaterialsFallback(materialTypes)
}

export function useFilamentCatalog(options?: { enabled?: boolean }): {
  materials: FilamentMaterial[]
  materialTypes: MaterialTypeDefinition[]
  materialStats: ReturnType<typeof typesToLegacyMap>
  loading: boolean
} {
  // Lazy-Load: Der Filament-Katalog wird erst geladen, wenn er gebraucht wird
  // (Produktdetailseite). Auf der Shop-Übersicht wäre der Abruf unnötig.
  const enabled = options?.enabled ?? true
  const defaults = buildDefaultMaterialTypes()
  const [materialTypes, setMaterialTypes] = useState(defaults)
  const [materials, setMaterials] = useState<FilamentMaterial[]>(() =>
    legacyMaterialsFallback(getActiveMaterialTypes(defaults))
  )
  const [materialStats, setMaterialStats] = useState(() =>
    typesToLegacyMap(getActiveMaterialTypes(defaults))
  )
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    // Wenn deaktiviert: nicht laden. Der Ladezustand ist über den Initialwert
    // (useState(enabled)) bereits korrekt (false).
    if (!enabled) return
    let cancelled = false

    void fetch("/api/filaments", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as {
          materials?: FilamentMaterial[]
          materialTypes?: MaterialTypeDefinition[]
          materialStats?: ReturnType<typeof typesToLegacyMap>
        } | null

        if (cancelled) return

        const nextTypes =
          Array.isArray(data?.materialTypes) && data.materialTypes.length > 0
            ? data.materialTypes
            : getActiveMaterialTypes(defaults)

        setMaterialTypes(nextTypes)
        setMaterials(resolveClientMaterials(data?.materials, nextTypes))

        if (data?.materialStats && typeof data.materialStats === "object") {
          setMaterialStats({ ...typesToLegacyMap(defaults), ...data.materialStats })
        } else {
          setMaterialStats(typesToLegacyMap(nextTypes))
        }
      })
      .catch(() => {
        if (cancelled) return
        console.warn("Filamente: API nicht erreichbar — Standard-Farben werden genutzt.")
        const fallbackTypes = getActiveMaterialTypes(defaults)
        setMaterialTypes(fallbackTypes)
        setMaterials(legacyMaterialsFallback(fallbackTypes))
        setMaterialStats(typesToLegacyMap(fallbackTypes))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return { materials, materialTypes, materialStats, loading }
}

export function useFilamentMaterials(): FilamentMaterial[] {
  return useFilamentCatalog().materials
}
