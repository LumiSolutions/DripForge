/** Kategorie eines Schweizer MWST-Steuercodes. */
export type TaxCodeCategory = "Umsatzsteuer" | "Vorsteuer" | "Befreit"

/** Editierbarer MWST-Steuercode (Schweizer Buchhaltung). */
export type TaxCode = {
  /** Kürzel / Primärschlüssel, z. B. "UN81", "VM81". */
  code: string
  /** Optionales Systemkürzel, z. B. "USt81", "VStM81". */
  systemCode?: string
  /** Vollständige Bezeichnung. */
  name: string
  /** Steuersatz als Dezimalzahl (0.081 = 8.1 %). */
  rate: number
  /** Steuerart für Auswertungen und Filter. */
  category: TaxCodeCategory
  /** Im Dropdown und bei Buchungen verfügbar. */
  isActive: boolean
  /** Sortierung in Listen (aufsteigend). */
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export const TAX_CODE_DOC_TYPE = "tax-code" as const

export type TaxCodeCosmosDoc = TaxCode & {
  id: string
  docType: typeof TAX_CODE_DOC_TYPE
}

export function taxCodeCosmosId(code: string): string {
  return `${TAX_CODE_DOC_TYPE}:${normalizeTaxCodeKey(code)}`
}

export function normalizeTaxCodeKey(value: unknown): string {
  if (value == null) return ""
  return String(value).trim().toUpperCase()
}

function roundRate(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function normalizeTaxCodeCategory(value: unknown): TaxCodeCategory {
  const raw = String(value ?? "").trim()
  if (raw === "Vorsteuer" || raw === "Umsatzsteuer" || raw === "Befreit") {
    return raw
  }
  return "Befreit"
}

export function normalizeTaxCode(
  input: Partial<TaxCode> & { code: string }
): TaxCode {
  const now = new Date().toISOString()
  const code = normalizeTaxCodeKey(input.code)
  return {
    code,
    systemCode: trimOptional(input.systemCode),
    name: String(input.name ?? "").trim(),
    rate: roundRate(Number(input.rate) || 0),
    category: normalizeTaxCodeCategory(input.category),
    isActive: input.isActive ?? true,
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }
}

function trimOptional(value: unknown): string | undefined {
  if (value == null) return undefined
  const trimmed = String(value).trim()
  return trimmed || undefined
}

export function toTaxCodeCosmosDoc(taxCode: TaxCode): TaxCodeCosmosDoc {
  return {
    ...taxCode,
    id: taxCodeCosmosId(taxCode.code),
    docType: TAX_CODE_DOC_TYPE,
  }
}

export function fromTaxCodeCosmosDoc(doc: TaxCodeCosmosDoc): TaxCode {
  const rawCode = doc.id.startsWith(`${TAX_CODE_DOC_TYPE}:`)
    ? doc.id.slice(TAX_CODE_DOC_TYPE.length + 1)
    : doc.code
  return normalizeTaxCode({ ...doc, code: rawCode })
}
