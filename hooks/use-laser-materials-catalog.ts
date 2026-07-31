"use client"

import { useEffect, useState } from "react"
import { laserMaterials as defaultLaserMaterials } from "@/lib/dripforge/data"
import type { LaserMaterial } from "@/lib/dripforge/types"

export function useLaserMaterialsCatalog(): {
  materials: LaserMaterial[]
  loading: boolean
} {
  const [materials, setMaterials] = useState<LaserMaterial[]>(defaultLaserMaterials)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void fetch("/api/laser-materials", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as {
          materials?: LaserMaterial[]
        } | null

        if (cancelled) return

        if (Array.isArray(data?.materials) && data.materials.length > 0) {
          setMaterials(data.materials)
        } else {
          setMaterials(defaultLaserMaterials)
        }
      })
      .catch(() => {
        if (cancelled) return
        console.warn(
          "Laser-Materialien: API nicht erreichbar — Katalog-Fallback wird genutzt."
        )
        setMaterials(defaultLaserMaterials)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { materials, loading }
}

export function useLaserMaterials(): LaserMaterial[] {
  return useLaserMaterialsCatalog().materials
}
