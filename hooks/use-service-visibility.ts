"use client"

import { useEffect, useState } from "react"
import type {
  ServiceVisibilitySettings,
  ShopConfiguratorSettings,
} from "@/lib/admin/types"
import {
  DEFAULT_SERVICE_VISIBILITY,
  DEFAULT_SHOP_CONFIGURATORS,
} from "@/lib/admin/types"
import { normalizeServiceVisibility } from "@/lib/dripforge/service-visibility"
import { normalizeShopConfigurators } from "@/lib/dripforge/shop-configurators"

export function useServiceVisibility(): {
  services: ServiceVisibilitySettings
  shopConfigurators: ShopConfiguratorSettings
  isLoaded: boolean
} {
  const [services, setServices] = useState<ServiceVisibilitySettings>(
    DEFAULT_SERVICE_VISIBILITY
  )
  const [shopConfigurators, setShopConfigurators] =
    useState<ShopConfiguratorSettings>(DEFAULT_SHOP_CONFIGURATORS)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    void fetch("/api/settings/services")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          const normalizedServices = normalizeServiceVisibility(data)
          setServices(normalizedServices)
          setShopConfigurators(
            normalizeShopConfigurators(data.shopConfigurators, normalizedServices)
          )
        }
      })
      .catch(() => {
        console.warn("Service-Sichtbarkeit konnte nicht geladen werden.")
      })
      .finally(() => {
        setIsLoaded(true)
      })
  }, [])

  return { services, shopConfigurators, isLoaded }
}
