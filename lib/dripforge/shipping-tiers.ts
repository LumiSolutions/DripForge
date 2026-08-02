import type { ShippingMethodId } from "@/lib/dripforge/checkout-config"

export type ShippingTierRule = {
  id: string
  /** Anzeigename (z. B. «Brief», «B-Post») */
  label: string
  methodId: ShippingMethodId | "brief"
  /** Max. Gesamtgewicht in Gramm (inkl.) */
  maxWeightG: number
  /** Optionale Maximalmasse der Sendung (mm) */
  maxLengthMm?: number | null
  maxWidthMm?: number | null
  maxHeightMm?: number | null
  priceChf: number
  active: boolean
}

export type ShippingTiersSettings = {
  /** Wenn false: Fallback auf klassische SHIPPING_OPTIONS */
  enabled: boolean
  tiers: ShippingTierRule[]
  /** Abholung immer anbieten */
  pickupEnabled: boolean
  pickupLabel: string
  pickupPriceChf: number
}

export const DEFAULT_SHIPPING_TIERS: ShippingTiersSettings = {
  enabled: true,
  pickupEnabled: true,
  pickupLabel: "Abholung in Pfäffikon ZH",
  pickupPriceChf: 0,
  tiers: [
    {
      id: "brief-100",
      label: "Brief",
      methodId: "brief",
      maxWeightG: 100,
      maxLengthMm: 353,
      maxWidthMm: 250,
      maxHeightMm: 30,
      priceChf: 2,
      active: true,
    },
    {
      id: "bpost-2000",
      label: "B-Post",
      methodId: "bpost",
      maxWeightG: 2000,
      maxLengthMm: 1000,
      maxWidthMm: 600,
      maxHeightMm: 600,
      priceChf: 7,
      active: true,
    },
    {
      id: "apost-30000",
      label: "A-Post",
      methodId: "apost",
      maxWeightG: 30000,
      maxLengthMm: 1000,
      maxWidthMm: 600,
      maxHeightMm: 600,
      priceChf: 9,
      active: true,
    },
  ],
}

export function normalizeShippingTiers(
  input?: Partial<ShippingTiersSettings> | null
): ShippingTiersSettings {
  const defaults = DEFAULT_SHIPPING_TIERS
  const rawTiers = Array.isArray(input?.tiers) ? input!.tiers : defaults.tiers
  const tiers = rawTiers
    .map((tier, index): ShippingTierRule | null => {
      if (!tier || typeof tier !== "object") return null
      const maxWeightG = Number(tier.maxWeightG)
      const priceChf = Number(tier.priceChf)
      if (!Number.isFinite(maxWeightG) || maxWeightG <= 0) return null
      if (!Number.isFinite(priceChf) || priceChf < 0) return null
      const methodId =
        tier.methodId === "apost" ||
        tier.methodId === "bpost" ||
        tier.methodId === "pickup" ||
        tier.methodId === "brief"
          ? tier.methodId
          : "bpost"
      return {
        id:
          typeof tier.id === "string" && tier.id.trim()
            ? tier.id.trim()
            : `tier-${index + 1}`,
        label:
          typeof tier.label === "string" && tier.label.trim()
            ? tier.label.trim().slice(0, 80)
            : methodId === "brief"
              ? "Brief"
              : methodId === "apost"
                ? "A-Post"
                : methodId === "bpost"
                  ? "B-Post"
                  : "Versand",
        methodId,
        maxWeightG: Math.round(maxWeightG),
        maxLengthMm:
          tier.maxLengthMm != null && Number.isFinite(Number(tier.maxLengthMm))
            ? Number(tier.maxLengthMm)
            : null,
        maxWidthMm:
          tier.maxWidthMm != null && Number.isFinite(Number(tier.maxWidthMm))
            ? Number(tier.maxWidthMm)
            : null,
        maxHeightMm:
          tier.maxHeightMm != null && Number.isFinite(Number(tier.maxHeightMm))
            ? Number(tier.maxHeightMm)
            : null,
        priceChf: Math.round(priceChf * 100) / 100,
        active: tier.active !== false,
      }
    })
    .filter((t): t is ShippingTierRule => Boolean(t))
    .sort((a, b) => a.maxWeightG - b.maxWeightG)

  return {
    enabled: input?.enabled !== false,
    pickupEnabled: input?.pickupEnabled !== false,
    pickupLabel:
      typeof input?.pickupLabel === "string" && input.pickupLabel.trim()
        ? input.pickupLabel.trim().slice(0, 120)
        : defaults.pickupLabel,
    pickupPriceChf:
      input?.pickupPriceChf != null &&
      Number.isFinite(Number(input.pickupPriceChf))
        ? Math.max(0, Number(input.pickupPriceChf))
        : defaults.pickupPriceChf,
    tiers: tiers.length > 0 ? tiers : defaults.tiers.map((t) => ({ ...t })),
  }
}

export type ResolvedShippingOption = {
  id: string
  methodId: ShippingMethodId | "brief"
  label: string
  price: number
}

function fitsDimensions(
  tier: ShippingTierRule,
  dims: { lengthMm: number; widthMm: number; heightMm: number }
): boolean {
  const sides = [dims.lengthMm, dims.widthMm, dims.heightMm]
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a)
  if (sides.length === 0) return true
  const [l = 0, w = 0, h = 0] = sides
  if (tier.maxLengthMm != null && l > tier.maxLengthMm) return false
  if (tier.maxWidthMm != null && w > tier.maxWidthMm) return false
  if (tier.maxHeightMm != null && h > tier.maxHeightMm) return false
  return true
}

/**
 * Wählt passende Versandoptionen anhand Gesamtgewicht und Maximalmassen.
 * Gibt mindestens die kleinste passende Staffel + ggf. Abholung zurück.
 */
export function resolveShippingOptionsForCart(
  settings: ShippingTiersSettings,
  input: {
    totalWeightG: number
    maxLengthMm?: number
    maxWidthMm?: number
    maxHeightMm?: number
  },
  fallback: ResolvedShippingOption[]
): ResolvedShippingOption[] {
  if (!settings.enabled) return fallback

  const weight = Math.max(0, Number(input.totalWeightG) || 0)
  const dims = {
    lengthMm: Number(input.maxLengthMm) || 0,
    widthMm: Number(input.maxWidthMm) || 0,
    heightMm: Number(input.maxHeightMm) || 0,
  }

  const active = settings.tiers.filter((t) => t.active)
  const matching = active.filter(
    (t) => weight <= t.maxWeightG && fitsDimensions(t, dims)
  )

  // Kleinste passende Staffeln je methodId (günstigste zuerst)
  const byMethod = new Map<string, ShippingTierRule>()
  for (const tier of matching) {
    const prev = byMethod.get(tier.methodId)
    if (!prev || tier.priceChf < prev.priceChf) {
      byMethod.set(tier.methodId, tier)
    }
  }

  let options: ResolvedShippingOption[] = Array.from(byMethod.values())
    .sort((a, b) => a.priceChf - b.priceChf || a.maxWeightG - b.maxWeightG)
    .map((t) => ({
      id: t.id,
      methodId: t.methodId,
      label: t.label,
      price: t.priceChf,
    }))

  // Keine passende Staffel → teuerste aktive Staffel als Fallback
  if (options.length === 0 && active.length > 0) {
    const heaviest = [...active].sort((a, b) => b.maxWeightG - a.maxWeightG)[0]!
    options = [
      {
        id: heaviest.id,
        methodId: heaviest.methodId,
        label: heaviest.label,
        price: heaviest.priceChf,
      },
    ]
  }

  if (settings.pickupEnabled) {
    options.push({
      id: "pickup",
      methodId: "pickup",
      label: settings.pickupLabel,
      price: settings.pickupPriceChf,
    })
  }

  return options.length > 0 ? options : fallback
}

export function estimateCartShippingMetrics(
  items: Array<{
    quantity?: number
    customDetails?: {
      dimensions?: string
      weightG?: number
    } | null
    /** Fallback-Gewicht pro Stück */
    weightG?: number | null
    dimensionsMm?: { length: number; width: number; height: number } | null
  }>
): {
  totalWeightG: number
  maxLengthMm: number
  maxWidthMm: number
  maxHeightMm: number
} {
  let totalWeightG = 0
  let maxLengthMm = 0
  let maxWidthMm = 0
  let maxHeightMm = 0

  for (const item of items) {
    const qty = Math.max(1, Number(item.quantity) || 1)
    const weight =
      Number(item.customDetails?.weightG) ||
      Number(item.weightG) ||
      0
    totalWeightG += Math.max(0, weight) * qty

    const dims = item.dimensionsMm
    if (dims) {
      maxLengthMm = Math.max(maxLengthMm, Number(dims.length) || 0)
      maxWidthMm = Math.max(maxWidthMm, Number(dims.width) || 0)
      maxHeightMm = Math.max(maxHeightMm, Number(dims.height) || 0)
    } else if (item.customDetails?.dimensions) {
      const nums = item.customDetails.dimensions
        .match(/[\d.]+/g)
        ?.map(Number)
        .filter((n) => Number.isFinite(n))
      if (nums && nums.length >= 3) {
        const sorted = [...nums].sort((a, b) => b - a)
        maxLengthMm = Math.max(maxLengthMm, sorted[0] ?? 0)
        maxWidthMm = Math.max(maxWidthMm, sorted[1] ?? 0)
        maxHeightMm = Math.max(maxHeightMm, sorted[2] ?? 0)
      }
    }
  }

  // Mindestgewicht, falls unbekannt (Brief-Staffel vermeiden → Paket)
  if (totalWeightG <= 0) totalWeightG = 250

  return { totalWeightG, maxLengthMm, maxWidthMm, maxHeightMm }
}
