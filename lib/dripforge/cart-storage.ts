import type { CartItem } from "@/lib/dripforge/types"
import { clearAllCartPreviews } from "@/lib/dripforge/cart-preview-persist"

export const CART_STORAGE_KEY = "dripforge-cart"

export function readClientCart(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as CartItem[]) : []
  } catch {
    return []
  }
}

function stripHeavyDataUrls(items: CartItem[]): CartItem[] {
  return items.map((item) => {
    const next = { ...item } as CartItem
    // Behalte komprimierte Previews; nur riesige Raw-PNGs entfernen (> ~180KB).
    const tooBig = (v: string | undefined) =>
      typeof v === "string" && v.startsWith("data:") && v.length > 180_000
    if (tooBig(next.leitbild)) delete next.leitbild
    if (tooBig(next.previewMockup)) delete next.previewMockup
    if (
      typeof next.productionLayer === "string" &&
      next.productionLayer.startsWith("data:")
    ) {
      delete next.productionLayer
    }
    return next
  })
}

export function writeClientCart(items: CartItem[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // QuotaExceeded: schlanke Variante ohne übergrosse Data-URLs (IndexedDB behält Originale).
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(stripHeavyDataUrls(items))
      )
    } catch {
      try {
        // Letzter Fallback: Previews ganz weglassen — Restore via IndexedDB.
        const bare = items.map((item) => {
          const next = { ...item } as CartItem
          if (typeof next.leitbild === "string" && next.leitbild.startsWith("data:")) {
            delete next.leitbild
          }
          if (
            typeof next.previewMockup === "string" &&
            next.previewMockup.startsWith("data:")
          ) {
            delete next.previewMockup
          }
          if (
            typeof next.productionLayer === "string" &&
            next.productionLayer.startsWith("data:")
          ) {
            delete next.productionLayer
          }
          return next
        })
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(bare))
      } catch {
        console.warn("Warenkorb: Speichern in localStorage fehlgeschlagen.")
      }
    }
  }
}

/** Sofort leeren (State + Storage) — z. B. nach Stripe-Erfolg. */
export function clearClientCart(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CART_STORAGE_KEY, "[]")
    localStorage.removeItem(CART_STORAGE_KEY)
    localStorage.setItem(CART_STORAGE_KEY, "[]")
  } catch {
    console.warn("Warenkorb: Leeren in localStorage fehlgeschlagen.")
  }
  try {
    sessionStorage.removeItem(CART_STORAGE_KEY)
  } catch {
    /* optional */
  }
  void clearAllCartPreviews()
}
