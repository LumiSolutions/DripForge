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
    console.warn("Warenkorb: Speichern in localStorage fehlgeschlagen.")
  }
}
