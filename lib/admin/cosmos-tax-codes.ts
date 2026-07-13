import type { SqlQuerySpec } from "@azure/cosmos"
import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import { DEFAULT_TAX_CODES } from "@/lib/accounting/tax-code-seed"
import {
  TAX_CODE_DOC_TYPE,
  fromTaxCodeCosmosDoc,
  normalizeTaxCode,
  normalizeTaxCodeKey,
  taxCodeCosmosId,
  toTaxCodeCosmosDoc,
  type TaxCode,
  type TaxCodeCosmosDoc,
} from "@/lib/accounting/tax-code-types"
import { sortTaxCodes } from "@/lib/accounting/tax-code-utils"

function cosmosErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const err = error as { code?: number; statusCode?: number }
  return err.code ?? err.statusCode
}

async function cosmosSeedDefaultTaxCodes(): Promise<TaxCode[]> {
  const container = await getSettingsContainer()
  const now = new Date().toISOString()
  const seeded: TaxCode[] = []

  for (const template of DEFAULT_TAX_CODES) {
    const taxCode = normalizeTaxCode({
      ...template,
      createdAt: now,
      updatedAt: now,
    })
    await container.items.upsert(toTaxCodeCosmosDoc(taxCode))
    seeded.push(taxCode)
  }

  return sortTaxCodes(seeded)
}

export async function cosmosGetTaxCodes(options?: {
  includeInactive?: boolean
}): Promise<TaxCode[]> {
  const container = await getSettingsContainer()
  const querySpec: SqlQuerySpec = {
    query: "SELECT * FROM c WHERE c.docType = @docType",
    parameters: [{ name: "@docType", value: TAX_CODE_DOC_TYPE }],
  }
  const { resources } = await container.items
    .query<TaxCodeCosmosDoc>(querySpec)
    .fetchAll()

  if (resources.length === 0) {
    return cosmosSeedDefaultTaxCodes()
  }

  let taxCodes = resources.map(fromTaxCodeCosmosDoc)
  if (!options?.includeInactive) {
    taxCodes = taxCodes.filter((item) => item.isActive)
  }
  return sortTaxCodes(taxCodes)
}

export async function cosmosGetTaxCodeByCode(code: string): Promise<TaxCode | null> {
  const normalized = normalizeTaxCodeKey(code)
  if (!normalized) return null

  const container = await getSettingsContainer()
  try {
    const cosmosId = taxCodeCosmosId(normalized)
    const { resource } = await container
      .item(cosmosId, cosmosId)
      .read<TaxCodeCosmosDoc>()
    if (!resource || resource.docType !== TAX_CODE_DOC_TYPE) return null
    return fromTaxCodeCosmosDoc(resource)
  } catch (error) {
    if (cosmosErrorCode(error) === 404) return null
    logCosmosError(`cosmosGetTaxCodeByCode:${code}`, error)
    throw error
  }
}

export async function cosmosUpsertTaxCode(taxCode: TaxCode): Promise<TaxCode> {
  const container = await getSettingsContainer()
  const normalized = normalizeTaxCode(taxCode)
  await container.items.upsert(toTaxCodeCosmosDoc(normalized))
  return normalized
}

export async function cosmosCreateTaxCode(input: {
  code: string
  systemCode?: string
  name: string
  rate: number
  category: TaxCode["category"]
  isActive?: boolean
  sortOrder?: number
}): Promise<TaxCode> {
  const code = normalizeTaxCodeKey(input.code)
  if (!code) {
    throw new Error("Steuercode fehlt.")
  }
  if (!String(input.name ?? "").trim()) {
    throw new Error("Bezeichnung fehlt.")
  }

  const existing = await cosmosGetTaxCodeByCode(code)
  if (existing) {
    throw new Error(`Steuercode ${code} existiert bereits.`)
  }

  const now = new Date().toISOString()
  const taxCode = normalizeTaxCode({
    code,
    systemCode: input.systemCode,
    name: input.name,
    rate: input.rate,
    category: input.category,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 999,
    createdAt: now,
    updatedAt: now,
  })

  return cosmosUpsertTaxCode(taxCode)
}

export async function cosmosUpdateTaxCode(
  code: string,
  patch: Partial<
    Pick<
      TaxCode,
      "systemCode" | "name" | "rate" | "category" | "isActive" | "sortOrder"
    >
  >
): Promise<TaxCode> {
  const existing = await cosmosGetTaxCodeByCode(code)
  if (!existing) {
    throw new Error(`Steuercode ${code} wurde nicht gefunden.`)
  }

  const updated = normalizeTaxCode({
    ...existing,
    ...patch,
    code: existing.code,
    updatedAt: new Date().toISOString(),
  })

  return cosmosUpsertTaxCode(updated)
}

export async function cosmosDeleteTaxCode(code: string): Promise<void> {
  const normalized = normalizeTaxCodeKey(code)
  if (!normalized) {
    throw new Error("Steuercode fehlt.")
  }

  const container = await getSettingsContainer()
  const cosmosId = taxCodeCosmosId(normalized)
  try {
    await container.item(cosmosId, cosmosId).delete()
  } catch (error) {
    if (cosmosErrorCode(error) === 404) {
      throw new Error(`Steuercode ${normalized} wurde nicht gefunden.`)
    }
    logCosmosError(`cosmosDeleteTaxCode:${normalized}`, error)
    throw error
  }
}

/** Stellt sicher, dass alle Standard-Codes vorhanden sind (fehlende werden ergänzt). */
export async function cosmosEnsureDefaultTaxCodes(): Promise<TaxCode[]> {
  const existing = await cosmosGetTaxCodes({ includeInactive: true })
  const existingCodes = new Set(existing.map((item) => item.code))
  const now = new Date().toISOString()
  const container = await getSettingsContainer()

  for (const template of DEFAULT_TAX_CODES) {
    if (existingCodes.has(template.code)) continue
    const taxCode = normalizeTaxCode({
      ...template,
      createdAt: now,
      updatedAt: now,
    })
    await container.items.upsert(toTaxCodeCosmosDoc(taxCode))
    existing.push(taxCode)
  }

  return sortTaxCodes(existing)
}
