import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import { DEFAULT_SHOP_CONFIGURATORS, type ShopConfiguratorSettings } from "@/lib/admin/types"

export const SHOP_CONFIGURATOR_TOGGLE_OPTIONS: {
  key: keyof ShopConfiguratorSettings
  label: string
  description: string
}[] = [
  {
    key: "custom3d",
    label: "Ihr Individueller 3D-Druck aktiv",
    description:
      "Steuert die Karte «Ihr Individueller 3D-Druck» im Shop-Bereich «Erschaffen Sie etwas Einzigartiges».",
  },
  {
    key: "customLaser",
    label: "Personalisierte Laserkreation aktiv",
    description:
      "Steuert die Karte «Personalisierte Laserkreation» im Shop-Bereich «Erschaffen Sie etwas Einzigartiges».",
  },
]

export function normalizeShopConfigurators(
  input?: Partial<ShopConfiguratorSettings> | null,
  services?: Partial<ServiceVisibilitySettings> | null
): ShopConfiguratorSettings {
  return {
    custom3d:
      input?.custom3d ??
      services?.druck3d ??
      DEFAULT_SHOP_CONFIGURATORS.custom3d,
    customLaser:
      input?.customLaser ??
      services?.lasergravur ??
      DEFAULT_SHOP_CONFIGURATORS.customLaser,
  }
}

export type StorefrontServicesPayload = ServiceVisibilitySettings & {
  shopConfigurators: ShopConfiguratorSettings
}

export function normalizeStorefrontServices(
  input?: Partial<StorefrontServicesPayload> | null
): StorefrontServicesPayload {
  const services = {
    druck3d: input?.druck3d ?? false,
    lasergravur: input?.lasergravur ?? true,
    laserschnitt: input?.laserschnitt ?? false,
    markierungAetzung: input?.markierungAetzung ?? false,
  }
  return {
    ...services,
    shopConfigurators: normalizeShopConfigurators(input?.shopConfigurators, services),
  }
}
