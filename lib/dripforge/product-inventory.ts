/**
 * Flexible Produkt-Lagerlogik:
 * - Ohne Bestandsverwaltung = unbegrenzt verfügbar (Default).
 * - Manuelle Überschreibung unabhängig vom Bestand.
 * - Optionale Mengenführung mit Schwellenwert und Verhalten bei Bestand 0.
 */

export type ProductManualAvailability =
  | "available"
  | "out_of_stock"
  | "coming_soon"

export type ProductZeroStockBehavior =
  | "sold_out"
  | "coming_soon"
  | "preorder"

export type ProductStockDisplayKind =
  | "available"
  | "low_stock"
  | "out_of_stock"
  | "coming_soon"
  | "preorder"

export type ProductStockState = {
  kind: ProductStockDisplayKind
  /** Kauf im Shop erlaubt (inkl. Vorbestellung). */
  canPurchase: boolean
  /** Badge auf Karten / PDP (null = kein Badge). */
  badgeLabel: string | null
  /** CTA-Beschriftung für den Warenkorb-Button. */
  ctaLabel: string
  /** Statuszeile unter dem Button / Lagerindikator. */
  statusMessage: string | null
  /** Warnfarbe für Indikator. */
  tone: "neutral" | "warning" | "danger" | "info"
  /** Verbleibende Stückzahl wenn tracking aktiv und qty > 0. */
  remainingQty: number | null
}

export const DEFAULT_LOW_STOCK_THRESHOLD = 3

export const MANUAL_AVAILABILITY_OPTIONS: Array<{
  value: ProductManualAvailability
  label: string
}> = [
  { value: "available", label: "Normal verfügbar" },
  { value: "out_of_stock", label: "Manuell nicht auf Lager" },
  { value: "coming_soon", label: "Bald verfügbar / In Nachproduktion" },
]

export const ZERO_STOCK_BEHAVIOR_OPTIONS: Array<{
  value: ProductZeroStockBehavior
  label: string
}> = [
  { value: "sold_out", label: "Ausverkauft" },
  { value: "coming_soon", label: "Bald wieder verfügbar" },
  { value: "preorder", label: "Vorbestellung erlaubt" },
]

export type ProductInventoryFields = {
  trackInventory?: boolean
  stockQuantity?: number
  lowStockThreshold?: number
  manualAvailability?: ProductManualAvailability
  zeroStockBehavior?: ProductZeroStockBehavior
}

export function normalizeManualAvailability(
  value: unknown
): ProductManualAvailability {
  if (value === "out_of_stock" || value === "coming_soon") return value
  return "available"
}

export function normalizeZeroStockBehavior(
  value: unknown
): ProductZeroStockBehavior {
  if (value === "coming_soon" || value === "preorder") return value
  return "sold_out"
}

export function normalizeLowStockThreshold(value: unknown): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 0) return DEFAULT_LOW_STOCK_THRESHOLD
  return Math.min(9999, n)
}

export function normalizeStockQuantity(value: unknown): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(999_999, n)
}

export function resolveProductStockState(
  product: ProductInventoryFields
): ProductStockState {
  const manual = normalizeManualAvailability(product.manualAvailability)

  if (manual === "out_of_stock") {
    return {
      kind: "out_of_stock",
      canPurchase: false,
      badgeLabel: "Ausverkauft",
      ctaLabel: "Derzeit nicht auf Lager",
      statusMessage: "Nicht auf Lager",
      tone: "danger",
      remainingQty: null,
    }
  }

  if (manual === "coming_soon") {
    return {
      kind: "coming_soon",
      canPurchase: false,
      badgeLabel: "Bald verfügbar",
      ctaLabel: "Bald wieder verfügbar",
      statusMessage: "Nicht auf Lager – Bald wieder verfügbar",
      tone: "warning",
      remainingQty: null,
    }
  }

  // Default: Bestandsverwaltung aus → unbegrenzt bestellbar
  if (!product.trackInventory) {
    return {
      kind: "available",
      canPurchase: true,
      badgeLabel: null,
      ctaLabel: "In den Warenkorb",
      statusMessage: null,
      tone: "neutral",
      remainingQty: null,
    }
  }

  const qty = normalizeStockQuantity(product.stockQuantity)
  const threshold = normalizeLowStockThreshold(product.lowStockThreshold)
  const zeroBehavior = normalizeZeroStockBehavior(product.zeroStockBehavior)

  if (qty <= 0) {
    if (zeroBehavior === "preorder") {
      return {
        kind: "preorder",
        canPurchase: true,
        badgeLabel: "Vorbestellung",
        ctaLabel: "Jetzt vorbestellen (Lieferzeit ca. 1–2 Wochen)",
        statusMessage: "Nicht auf Lager – Vorbestellung möglich",
        tone: "info",
        remainingQty: 0,
      }
    }
    if (zeroBehavior === "coming_soon") {
      return {
        kind: "coming_soon",
        canPurchase: false,
        badgeLabel: "Bald verfügbar",
        ctaLabel: "Bald wieder verfügbar",
        statusMessage: "Nicht auf Lager – Bald wieder verfügbar",
        tone: "warning",
        remainingQty: 0,
      }
    }
    return {
      kind: "out_of_stock",
      canPurchase: false,
      badgeLabel: "Ausverkauft",
      ctaLabel: "Derzeit ausverkauft",
      statusMessage: "Nicht auf Lager",
      tone: "danger",
      remainingQty: 0,
    }
  }

  if (qty <= threshold) {
    return {
      kind: "low_stock",
      canPurchase: true,
      badgeLabel: `Nur noch ${qty}`,
      ctaLabel: "In den Warenkorb",
      statusMessage: `Nur noch ${qty} Stück auf Lager – bald ausverkauft!`,
      tone: "warning",
      remainingQty: qty,
    }
  }

  return {
    kind: "available",
    canPurchase: true,
    badgeLabel: null,
    ctaLabel: "In den Warenkorb",
    statusMessage: null,
    tone: "neutral",
    remainingQty: qty,
  }
}

/** Shop-Raster: Badge nur bei Ausverkauf / Bald / Vorbestellung (nicht bei Low-Stock). */
export function resolveShopCardStockBadge(
  product: ProductInventoryFields
): { label: string; dimImage: boolean } | null {
  const state = resolveProductStockState(product)
  if (
    state.kind === "out_of_stock" ||
    state.kind === "coming_soon" ||
    state.kind === "preorder"
  ) {
    return {
      label: state.badgeLabel ?? state.kind,
      dimImage: !state.canPurchase,
    }
  }
  return null
}
