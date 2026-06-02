import type { Product } from "@/lib/dripforge/types"

/**
 * Wandelt Admin-Eingabe (kommagetrennt) in ein Varianten-Array um.
 * Beispiel: "Echtleder Braun, Echtleder Schwarz"
 */
export function parseVariantenFromAdmin(
  input: string | null | undefined
): string[] {
  if (!input?.trim()) return []
  return input
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/** Normalisiert gespeicherte Produkt-Varianten aus DB/JSON. */
export function resolveProductVarianten(product: Product): string[] {
  if (!product.varianten?.length) return []
  return product.varianten.map((v) => v.trim()).filter(Boolean)
}

/** Fuer Admin-Vorschau: Array als kommagetrennten Text. */
export function formatVariantenForAdmin(varianten: string[]): string {
  return varianten.join(", ")
}

export function productHasVarianten(product: Product): boolean {
  return resolveProductVarianten(product).length > 0
}

export function getDefaultSelectedVariante(varianten: string[]): string {
  return varianten[0] ?? ""
}
