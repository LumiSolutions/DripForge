export const PRODUCT_TEXT_OPTION_FIELDS = [
  "productName",
  "description",
  "variantKeywords",
  "shopVariantName",
  "partLabels",
  "filamentColor",
] as const

export type ProductTextOptionField = (typeof PRODUCT_TEXT_OPTION_FIELDS)[number]

export type ProductTextOption = {
  id: string
  field: ProductTextOptionField
  text: string
  updatedAt: string
}

export function isProductTextOptionField(
  value: string
): value is ProductTextOptionField {
  return (PRODUCT_TEXT_OPTION_FIELDS as readonly string[]).includes(value)
}

export function normalizeProductTextOptionKey(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase()
}

export function createProductTextOptionId(field: ProductTextOptionField): string {
  return `ptxt-${field}-${Date.now().toString(36)}`
}

export function normalizeProductTextOption(
  input: Partial<ProductTextOption> & { field: ProductTextOptionField; text: string },
  existing?: ProductTextOption
): ProductTextOption {
  return {
    id: input.id?.trim() || existing?.id || createProductTextOptionId(input.field),
    field: input.field,
    text: input.text.trim(),
    updatedAt: input.updatedAt ?? existing?.updatedAt ?? new Date().toISOString(),
  }
}

export function normalizeProductTextOptions(input: unknown): ProductTextOption[] {
  if (!Array.isArray(input)) return []
  return input
    .flatMap((entry): ProductTextOption[] => {
      if (!entry || typeof entry !== "object") return []
      const candidate = entry as { field?: unknown; text?: unknown }
      if (typeof candidate.field !== "string" || typeof candidate.text !== "string") {
        return []
      }
      if (!isProductTextOptionField(candidate.field)) return []
      return [
        normalizeProductTextOption({
          ...(entry as Partial<ProductTextOption>),
          field: candidate.field,
          text: candidate.text,
        }),
      ]
    })
    .filter((entry) => entry.text.length > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 200)
}
