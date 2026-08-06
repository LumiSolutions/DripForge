import { promises as fs } from "fs"
import path from "path"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import { getSettingsContainer } from "@/lib/cosmos/client"
import {
  normalizeProductTextOption,
  normalizeProductTextOptionKey,
  normalizeProductTextOptions,
  type ProductTextOption,
} from "@/lib/admin/product-text-options"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const OPTIONS_FILE = "product-text-options.json"
const DOC_ID = "product-text-options"
const DOC_TYPE = "productTextOptions"

type ProductTextOptionsDoc = {
  id: string
  docType: typeof DOC_TYPE
  options: ProductTextOption[]
  updatedAt: string
}

function cosmosErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const err = error as { code?: number; statusCode?: number }
  return err.code ?? err.statusCode
}

async function readOptionsFile(): Promise<ProductTextOption[]> {
  const filePath = path.join(DATA_DIR, OPTIONS_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    return normalizeProductTextOptions(JSON.parse(raw))
  } catch {
    return []
  }
}

async function writeOptionsFile(options: ProductTextOption[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(
    path.join(DATA_DIR, OPTIONS_FILE),
    JSON.stringify(normalizeProductTextOptions(options), null, 2),
    "utf-8"
  )
}

async function readOptionsCosmos(): Promise<ProductTextOption[]> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(DOC_ID, DOC_ID)
      .read<ProductTextOptionsDoc>()
    return normalizeProductTextOptions(resource?.options)
  } catch (error) {
    if (cosmosErrorCode(error) === 404) return []
    throw error
  }
}

async function writeOptionsCosmos(options: ProductTextOption[]): Promise<void> {
  const container = await getSettingsContainer()
  const normalized = normalizeProductTextOptions(options)
  await container.items.upsert<ProductTextOptionsDoc>({
    id: DOC_ID,
    docType: DOC_TYPE,
    options: normalized,
    updatedAt: new Date().toISOString(),
  })
}

export async function getProductTextOptions(): Promise<ProductTextOption[]> {
  return withCosmosFallback(
    "getProductTextOptions",
    readOptionsCosmos,
    readOptionsFile
  )
}

export async function upsertProductTextOption(
  option: ProductTextOption
): Promise<{ option: ProductTextOption; options: ProductTextOption[]; duplicate: boolean }> {
  const current = await getProductTextOptions()
  const normalized = normalizeProductTextOption(option)
  const duplicate = current.find(
    (entry) =>
      entry.field === normalized.field &&
      normalizeProductTextOptionKey(entry.text) ===
        normalizeProductTextOptionKey(normalized.text)
  )

  if (duplicate) {
    return { option: duplicate, options: current, duplicate: true }
  }

  const next = normalizeProductTextOptions([normalized, ...current])
  await withCosmosFallback(
    "saveProductTextOptions",
    () => writeOptionsCosmos(next),
    () => writeOptionsFile(next)
  )
  return { option: normalized, options: next, duplicate: false }
}
