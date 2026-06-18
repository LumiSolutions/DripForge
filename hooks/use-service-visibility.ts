"use client"

import { useEffect, useState } from "react"
import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import { DEFAULT_SERVICE_VISIBILITY } from "@/lib/admin/types"
import { normalizeServiceVisibility } from "@/lib/dripforge/service-visibility"

export function useServiceVisibility(): {
  services: ServiceVisibilitySettings
  isLoaded: boolean
} {
  const [services, setServices] = useState<ServiceVisibilitySettings>(
    DEFAULT_SERVICE_VISIBILITY
  )
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    void fetch("/api/settings/services")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setServices(normalizeServiceVisibility(data))
      })
      .catch(() => {
        console.warn("Service-Sichtbarkeit konnte nicht geladen werden.")
      })
      .finally(() => {
        setIsLoaded(true)
      })
  }, [])

  return { services, isLoaded }
}
