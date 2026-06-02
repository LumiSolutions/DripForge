export type WorkAreaMm = {
  widthMm: number
  heightMm: number
}

export type LaserSizePreset = {
  id: string
  name: string
  dimensionsLabel: string
  widthMm: number
  heightMm: number
  priceMultiplier: number
}

/** Groessen fuer individuelle Laserauftraege */
export const INDIVIDUAL_LASER_SIZES: LaserSizePreset[] = [
  {
    id: "small",
    name: "Klein",
    dimensionsLabel: "100 x 100 mm",
    widthMm: 100,
    heightMm: 100,
    priceMultiplier: 0.6,
  },
  {
    id: "medium",
    name: "Mittel",
    dimensionsLabel: "150 x 150 mm",
    widthMm: 150,
    heightMm: 150,
    priceMultiplier: 1,
  },
  {
    id: "large",
    name: "Gross",
    dimensionsLabel: "200 x 200 mm",
    widthMm: 200,
    heightMm: 200,
    priceMultiplier: 1.5,
  },
]

export const DEFAULT_WORK_AREA_MM: WorkAreaMm = {
  widthMm: 150,
  heightMm: 150,
}

export function getWorkAreaForSizeId(sizeId: string): WorkAreaMm {
  const preset =
    INDIVIDUAL_LASER_SIZES.find((s) => s.id === sizeId) ??
    INDIVIDUAL_LASER_SIZES.find((s) => s.id === "medium")!
  return { widthMm: preset.widthMm, heightMm: preset.heightMm }
}
