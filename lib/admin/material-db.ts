import { promises as fs } from "fs"
import path from "path"
import {
  cosmosDeleteMaterial,
  cosmosGetMaterialById,
  cosmosGetMaterials,
  cosmosUpsertMaterial,
  normalizeMaterialItem,
} from "@/lib/admin/cosmos-materials"
import {
  createMaterialId,
  createMaterialVariantId,
  MATERIAL_DOC_TYPE,
  type MaterialCategory,
  type MaterialItem,
  type MaterialVariant,
} from "@/lib/admin/material-types"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import { logCosmosError } from "@/lib/cosmos/log-error"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const MATERIALS_FILE = "materials.json"

async function readMaterialsFile(): Promise<MaterialItem[]> {
  const filePath = path.join(DATA_DIR, MATERIALS_FILE)
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw) as MaterialItem[]
    return parsed.map((m) => normalizeMaterialItem({ ...m, id: m.id }))
  } catch {
    return []
  }
}

async function writeMaterialsFile(materials: MaterialItem[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const filePath = path.join(DATA_DIR, MATERIALS_FILE)
  await fs.writeFile(filePath, JSON.stringify(materials, null, 2), "utf-8")
}

export async function getMaterials(
  category?: MaterialCategory
): Promise<MaterialItem[]> {
  try {
    const all = await withCosmosFallback(
      "getMaterials",
      () => cosmosGetMaterials(category),
      readMaterialsFile
    )
    return category ? all.filter((m) => m.category === category) : all
  } catch (error) {
    logCosmosError("getMaterials:total-failure", error)
    const all = await readMaterialsFile().catch(() => [])
    return category ? all.filter((m) => m.category === category) : all
  }
}

export async function getMaterialById(id: string): Promise<MaterialItem | null> {
  return withCosmosFallback(
    "getMaterialById",
    () => cosmosGetMaterialById(id),
    async () => {
      const materials = await readMaterialsFile()
      return materials.find((m) => m.id === id) ?? null
    }
  )
}

export async function upsertMaterial(material: MaterialItem): Promise<MaterialItem> {
  const next = normalizeMaterialItem({
    ...material,
    docType: MATERIAL_DOC_TYPE,
    updatedAt: new Date().toISOString(),
  })

  await withCosmosFallback(
    "upsertMaterial",
    async () => {
      await cosmosUpsertMaterial(next)
    },
    async () => {
      const materials = await readMaterialsFile()
      const index = materials.findIndex((m) => m.id === next.id)
      if (index >= 0) materials[index] = next
      else materials.push(next)
      await writeMaterialsFile(materials)
    }
  )
  return next
}

export async function deleteMaterial(id: string): Promise<boolean> {
  const result = await withCosmosFallback(
    "deleteMaterial",
    () => cosmosDeleteMaterial(id),
    async () => {
      const materials = await readMaterialsFile()
      const filtered = materials.filter((m) => m.id !== id)
      if (filtered.length === materials.length) return false
      await writeMaterialsFile(filtered)
      return true
    }
  )
  return Boolean(result)
}

export function createMaterialInput(input: {
  name: string
  category: MaterialCategory
  stockUnit?: MaterialItem["stockUnit"]
}): MaterialItem {
  const now = new Date().toISOString()
  return normalizeMaterialItem({
    id: createMaterialId(input.name),
    docType: MATERIAL_DOC_TYPE,
    category: input.category,
    name: input.name,
    stockUnit: input.stockUnit ?? (input.category === "filament" ? "gram" : "piece"),
    stockAvailable: 0,
    stockReserved: 0,
    variants: [],
    vorteile: [],
    hinweise: [],
    updatedAt: now,
  })
}
