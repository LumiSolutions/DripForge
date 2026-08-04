/** Normalisiert eine Logo-/Icon-URL (http(s), Pfad oder data:) oder null. */
export function normalizeBrandUrl(input: unknown): string | null {
  if (typeof input !== "string") return null
  const trimmed = input.trim()
  if (!trimmed) return null
  // data:-URLs (Inline-Fallback ohne Blob-Storage) können gross sein → grosszügig.
  return trimmed.slice(0, 5_000_000)
}
