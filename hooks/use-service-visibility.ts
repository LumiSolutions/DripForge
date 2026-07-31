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
import {
  normalizeManagedCatalog,
  type ManagedCatalogItem,
} from "@/lib/dripforge/managed-catalog"

export function useServiceVisibility(): {
  services: ServiceVisibilitySettings
  shopConfigurators: ShopConfiguratorSettings
  managedCatalog: ManagedCatalogItem[]
  isLoaded: boolean
} {
  const [services, setServices] = useState<ServiceVisibilitySettings>(
    DEFAULT_SERVICE_VISIBILITY
  )
  const [shopConfigurators, setShopConfigurators] =
    useState<ShopConfiguratorSettings>(DEFAULT_SHOP_CONFIGURATORS)
  const [managedCatalog, setManagedCatalog] = useState<ManagedCatalogItem[]>(() =>
    normalizeManagedCatalog(null, DEFAULT_SERVICE_VISIBILITY, DEFAULT_SHOP_CONFIGURATORS)
  )
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    void fetch("/api/settings/services")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          const normalizedServices = normalizeServiceVisibility(data)
          const normalizedShop = normalizeShopConfigurators(
            data.shopConfigurators,
            normalizedServices
          )
          setServices(normalizedServices)
          setShopConfigurators(normalizedShop)
          setManagedCatalog(
            normalizeManagedCatalog(
              data.managedCatalog,
              normalizedServices,
              normalizedShop
            )
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

  return { services, shopConfigurators, managedCatalog, isLoaded }
}
