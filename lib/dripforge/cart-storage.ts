import type { CartItem } from "@/lib/dripforge/types"

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

export function writeClientCart(items: CartItem[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // QuotaExceeded bei grossen Leitbild/Mockup-Data-URLs — ohne Preview speichern.
    try {
      const slim = items.map((item) => {
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
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(slim))
    } catch {
      console.warn("Warenkorb: Speichern in localStorage fehlgeschlagen.")
    }
  }
}

/** Sofort leeren (State + Storage) — z. B. nach Stripe-Erfolg. */
export function clearClientCart(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CART_STORAGE_KEY, "[]")
    localStorage.removeItem(CART_STORAGE_KEY)
    // Danach leeres Array setzen, damit Hydration/Persist konsistent bleibt
    localStorage.setItem(CART_STORAGE_KEY, "[]")
  } catch {
    console.warn("Warenkorb: Leeren in localStorage fehlgeschlagen.")
  }
  try {
    sessionStorage.removeItem(CART_STORAGE_KEY)
  } catch {
    /* optional */
  }
}
