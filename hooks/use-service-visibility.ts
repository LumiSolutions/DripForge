"use client"

import { useEffect, useState } from "react"
import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import { DEFAULT_SERVICE_VISIBILITY } from "@/lib/admin/types"
import { normalizeServiceVisibility } from "@/lib/dripforge/service-visibility"

export function useServiceVisibility(): ServiceVisibilitySettings {
  const [services, setServices] = useState<ServiceVisibilitySettings>(
    DEFAULT_SERVICE_VISIBILITY
  )

  useEffect(() => {
    void fetch("/api/settings/services")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setServices(normalizeServiceVisibility(data))
      })
      .catch(() => {
        console.warn("Service-Sichtbarkeit konnte nicht geladen werden.")
      })
  }, [])

  return services
}
