import { promises as fs } from "fs"
import path from "path"
import {
  cosmosDeleteProductTag,
  cosmosGetProductTagById,
  cosmosGetProductTags,
  cosmosUpsertProductTag,
} from "@/lib/admin/cosmos-product-tags"
import { normalizeProductTag, type ProductTag } from "@/lib/admin/product-tags"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import { logCosmosError } from "@/lib/cosmos/log-error"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const TAGS_FILE = "product-tags.json"

async function readTagsFile(): Promise<ProductTag[]> {
  const filePath = path.join(DATA_DIR, TAGS_FILE)
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw) as ProductTag[]
    return parsed.map((tag) => normalizeProductTag(tag))
  } catch {
    return []
  }
}

async function writeTagsFile(tags: ProductTag[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const filePath = path.join(DATA_DIR, TAGS_FILE)
  await fs.writeFile(filePath, JSON.stringify(tags, null, 2), "utf-8")
}

export async function getProductTags(): Promise<ProductTag[]> {
  try {
    return await withCosmosFallback("getProductTags", cosmosGetProductTags, readTagsFile)
  } catch (error) {
    logCosmosError("getProductTags:total-failure", error)
    return readTagsFile().catch(() => [])
  }
}

export async function getProductTagById(id: string): Promise<ProductTag | null> {
  return withCosmosFallback(
    "getProductTagById",
    () => cosmosGetProductTagById(id),
    async () => {
      const tags = await readTagsFile()
      return tags.find((tag) => tag.id === id) ?? null
    }
  )
}

export async function upsertProductTag(tag: ProductTag): Promise<ProductTag> {
  const normalized = normalizeProductTag(tag)
  return withCosmosFallback(
    "upsertProductTag",
    () => cosmosUpsertProductTag(normalized),
    async () => {
      const tags = await readTagsFile()
      const next = tags.filter((entry) => entry.id !== normalized.id)
      next.push(normalized)
      next.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"))
      await writeTagsFile(next)
      return normalized
    }
  )
}

export async function deleteProductTag(id: string): Promise<boolean> {
  return withCosmosFallback(
    "deleteProductTag",
    () => cosmosDeleteProductTag(id),
    async () => {
      const tags = await readTagsFile()
      const next = tags.filter((tag) => tag.id !== id)
      if (next.length === tags.length) return false
      await writeTagsFile(next)
      return true
    }
  )
}
