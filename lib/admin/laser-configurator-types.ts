export const LASER_CONFIGURATOR_DOC_ID = "laser-configurator-settings"
export const LASER_CONFIGURATOR_DOC_TYPE = "laser-configurator-settings"

export type LaserMaxWorkAreaMm = {
  lengthMm: number
  widthMm: number
  heightMm: number
}

export type LaserConfiguratorSettings = {
  /** Option «Eigenes Produkt einschicken & verarbeiten» (Personalisierte Laserkreation) */
  allowCustomerShipping: boolean
  /** Einsende-Instruktionen & Lieferadresse für Kunden-Einsendungen */
  customerShippingInstructions: string
  /** Maximale Bearbeitungsmaße der Laser-Maschine (L × B × H) */
  maxWorkAreaMm: LaserMaxWorkAreaMm
  updatedAt: string
}

export const DEFAULT_LASER_MAX_WORK_AREA_MM: LaserMaxWorkAreaMm = {
  lengthMm: 300,
  widthMm: 200,
  heightMm: 50,
}

function clampDim(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(2000, Math.round(n * 10) / 10)
}

export function createDefaultLaserConfiguratorSettings(): LaserConfiguratorSettings {
  return {
    allowCustomerShipping: false,
    customerShippingInstructions: "",
    maxWorkAreaMm: { ...DEFAULT_LASER_MAX_WORK_AREA_MM },
    updatedAt: new Date().toISOString(),
  }
}

export function sanitizeLaserConfiguratorSettings(
  input: Partial<LaserConfiguratorSettings> | null | undefined
): LaserConfiguratorSettings {
  const defaults = createDefaultLaserConfiguratorSettings()
  if (!input) return defaults

  const rawArea = input.maxWorkAreaMm
  return {
    allowCustomerShipping: input.allowCustomerShipping === true,
    customerShippingInstructions: String(
      input.customerShippingInstructions ?? defaults.customerShippingInstructions
    ).slice(0, 4000),
    maxWorkAreaMm: {
      lengthMm: clampDim(rawArea?.lengthMm, defaults.maxWorkAreaMm.lengthMm),
      widthMm: clampDim(rawArea?.widthMm, defaults.maxWorkAreaMm.widthMm),
      heightMm: clampDim(rawArea?.heightMm, defaults.maxWorkAreaMm.heightMm),
    },
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
    maxWorkAreaMm: {
      ...defaults.maxWorkAreaMm,
      ...(stored.maxWorkAreaMm ?? {}),
    },
  })
}

export function formatLaserMaxWorkAreaLabel(area: LaserMaxWorkAreaMm): string {
  return `Max. Gravurfläche: ${area.lengthMm} × ${area.widthMm} × ${area.heightMm} mm`
}
