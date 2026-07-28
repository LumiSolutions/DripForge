export const LASER_CONFIGURATOR_DOC_ID = "laser-configurator-settings"
export const LASER_CONFIGURATOR_DOC_TYPE = "laser-configurator-settings"

export type LaserConfiguratorSettings = {
  /** Option «Eigenes Produkt einschicken & verarbeiten» (Personalisierte Laserkreation) */
  allowCustomerShipping: boolean
  /** Einsende-Instruktionen & Lieferadresse für Kunden-Einsendungen */
  customerShippingInstructions: string
  updatedAt: string
}

export function createDefaultLaserConfiguratorSettings(): LaserConfiguratorSettings {
  return {
    allowCustomerShipping: false,
    customerShippingInstructions: "",
    updatedAt: new Date().toISOString(),
  }
}

export function sanitizeLaserConfiguratorSettings(
  input: Partial<LaserConfiguratorSettings> | null | undefined
): LaserConfiguratorSettings {
  const defaults = createDefaultLaserConfiguratorSettings()
  if (!input) return defaults

  return {
    allowCustomerShipping: input.allowCustomerShipping === true,
    customerShippingInstructions: String(
      input.customerShippingInstructions ?? defaults.customerShippingInstructions
    ).slice(0, 4000),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }
}

export function mergeLaserConfiguratorSettings(
  stored: Partial<LaserConfiguratorSettings> | null | undefined
): LaserConfiguratorSettings {
  const defaults = createDefaultLaserConfiguratorSettings()
  if (!stored) return defaults
  return sanitizeLaserConfiguratorSettings({
    ...defaults,
    ...stored,
  })
}
