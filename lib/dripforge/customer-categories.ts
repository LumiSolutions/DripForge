import type { ShippingMethodId } from "@/lib/dripforge/checkout-config"

/**
 * Kundenkategorie / -gruppe (z. B. "Friends & Family", "B2B").
 * Konfiguration liegt global in den Admin-Einstellungen; die Zuordnung erfolgt
 * pro Kundenkonto (customerCategoryId).
 */
export type CustomerCategory = {
  id: string
  name: string
  /** Rabatt in Prozent (0–100) auf Produktpreise. */
  discountPercent: number
  /** Zugelassene Versandarten für diese Kategorie (leer = alle erlaubt). */
  allowedShippingMethodIds: ShippingMethodId[]
}

const SHIPPING_METHOD_IDS: ShippingMethodId[] = ["apost", "bpost", "pickup", "brief"]

function makeCategoryId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
  } catch {
    /* ignore */
  }
  return `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function clampDiscountPercent(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100))
}

function normalizeShippingIds(input: unknown): ShippingMethodId[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<ShippingMethodId>()
  for (const raw of input) {
    if (typeof raw === "string" && (SHIPPING_METHOD_IDS as string[]).includes(raw)) {
      seen.add(raw as ShippingMethodId)
    }
  }
  return Array.from(seen)
}

export function normalizeCustomerCategory(
  input: Partial<CustomerCategory> | null | undefined
): CustomerCategory {
  return {
    id:
      typeof input?.id === "string" && input.id.trim()
        ? input.id.trim().slice(0, 64)
        : makeCategoryId(),
    name: typeof input?.name === "string" ? input.name.trim().slice(0, 80) : "",
    discountPercent: clampDiscountPercent(input?.discountPercent),
    allowedShippingMethodIds: normalizeShippingIds(input?.allowedShippingMethodIds),
  }
}

export function normalizeCustomerCategories(
  input: unknown
): CustomerCategory[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry) => normalizeCustomerCategory(entry as Partial<CustomerCategory>))
    .filter((cat) => cat.name.length > 0)
}

export function createEmptyCustomerCategory(): CustomerCategory {
  return {
    id: makeCategoryId(),
    name: "",
    discountPercent: 0,
    allowedShippingMethodIds: [],
  }
}

export function findCustomerCategory(
  categories: CustomerCategory[] | undefined | null,
  categoryId: string | null | undefined
): CustomerCategory | null {
  if (!categoryId) return null
  return categories?.find((c) => c.id === categoryId) ?? null
}

/** Wendet den Kategorierabatt auf einen Preis an (nie negativ). */
export function applyCategoryDiscount(price: number, discountPercent: number): number {
  const base = Number(price)
  if (!Number.isFinite(base) || base <= 0) return Math.max(0, base || 0)
  const pct = clampDiscountPercent(discountPercent)
  if (pct <= 0) return base
  return Math.max(0, base * (1 - pct / 100))
}
