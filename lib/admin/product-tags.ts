export const PRODUCT_TAG_DOC_TYPE = "productTag" as const

export type ProductTag = {
  id: string
  docType: typeof PRODUCT_TAG_DOC_TYPE
  name: string
  sortOrder: number
  updatedAt: string
}

export function createProductTagId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `ptag-${slug || "tag"}-${Date.now().toString(36)}`
}

export function normalizeProductTag(
  input: Partial<ProductTag> & { id?: string; name?: string },
  existing?: ProductTag
): ProductTag {
  const name = input.name?.trim() || existing?.name || "Neuer Tag"
  return {
    id: input.id?.trim() || existing?.id || createProductTagId(name),
    docType: PRODUCT_TAG_DOC_TYPE,
    name,
    sortOrder:
      input.sortOrder != null
        ? Math.max(0, Math.round(Number(input.sortOrder)))
        : existing?.sortOrder ?? 0,
    updatedAt: new Date().toISOString(),
  }
}

export function normalizeProductTagIds(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))]
}
