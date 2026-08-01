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
  MATERIAL_DOC_TYPE,
  type MaterialCategory,
  type MaterialItem,
} from "@/lib/admin/material-types"
import {
  CosmosDatabaseError,
  withCosmosFallback,
  withCosmosRequired,
} from "@/lib/admin/storage-bridge"
import { isCosmosConfigured } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import { buildDefaultLaserStockMaterials } from "@/lib/admin/seed-laser-materials"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const MATERIALS_FILE = "materials.json"

/**
 * Lokales JSON-Fallback nur in Entwicklung oder wenn explizit erlaubt.
 * Produktion (Azure SWA) ist flüchtig — Lagerdaten müssen in Cosmos liegen.
 */
function allowMaterialsFileFallback(): boolean {
  if (process.env.ALLOW_FS_ADMIN_FALLBACK === "1") return true
  if (process.env.NODE_ENV === "production" && isCosmosConfigured()) return false
  if (process.env.NODE_ENV === "production") return false
  return true
}

async function readMaterialsFile(): Promise<MaterialItem[]> {
  const filePath = path.join(DATA_DIR, MATERIALS_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw) as MaterialItem[]
    return Array.isArray(parsed)
      ? parsed.map((m) => normalizeMaterialItem({ ...m, id: m.id }))
      : []
  } catch {
    return []
  }
}

async function writeMaterialsFile(materials: MaterialItem[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const filePath = path.join(DATA_DIR, MATERIALS_FILE)
  await fs.writeFile(filePath, JSON.stringify(materials, null, 2), "utf-8")
}

/** Optional: Snapshot vor Migrationen (bestehende Datei/Cosmos-Export). */
export async function backupMaterialsFileSnapshot(): Promise<string | null> {
  try {
    const materials = await readMaterialsFile()
    if (materials.length === 0) return null
    await fs.mkdir(DATA_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const target = path.join(DATA_DIR, `materials.backup-${stamp}.json`)
    await fs.writeFile(target, JSON.stringify(materials, null, 2), "utf-8")
    return target
  } catch {
    return null
  }
}

export async function getMaterials(
  category?: MaterialCategory
): Promise<MaterialItem[]> {
  if (!allowMaterialsFileFallback()) {
    const all = await withCosmosRequired("getMaterials", () =>
      cosmosGetMaterials(category)
    )
    return category ? all.filter((m) => m.category === category) : all
  }

  try {
    const all = await withCosmosFallback(
      "getMaterials",
      () => cosmosGetMaterials(category),
      readMaterialsFile
    )
    return category ? all.filter((m) => m.category === category) : all
  } catch (error) {
    logCosmosError("getMaterials:total-failure", error)
    if (error instanceof CosmosDatabaseError) throw error
    const all = await readMaterialsFile().catch(() => [])
    return category ? all.filter((m) => m.category === category) : all
  }
}

/**
 * Laser-Seed nur manuell (?seed=1) und nur wenn Kategorie leer.
 * Niemals Filamente seeden. Niemals bestehende Daten löschen.
 * In Produktion nur mit ALLOW_LASER_SEED_IN_PROD=1.
 */
export async function ensureLaserStockMaterialsSeeded(): Promise<MaterialItem[]> {
  const existing = await getMaterials("lasermaterial")
  if (existing.length > 0) return existing

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_LASER_SEED_IN_PROD !== "1"
  ) {
    return existing
  }

  const defaults = buildDefaultLaserStockMaterials()
  const saved: MaterialItem[] = []
  for (const item of defaults) {
    try {
      saved.push(await upsertMaterial(item))
    } catch (error) {
      logCosmosError(`ensureLaserStock:upsert:${item.id}`, error)
    }
  }
  return saved
}

export async function getMaterialById(id: string): Promise<MaterialItem | null> {
  if (!allowMaterialsFileFallback()) {
    return withCosmosRequired("getMaterialById", () => cosmosGetMaterialById(id))
  }
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

  // Produktion: immer Cosmos — kein stilles Schreiben auf flüchtiges Dateisystem.
  if (!allowMaterialsFileFallback()) {
    await withCosmosRequired("upsertMaterial", async () => {
      await cosmosUpsertMaterial(next)
    })
    return next
  }

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
  if (!allowMaterialsFileFallback()) {
    return withCosmosRequired("deleteMaterial", () => cosmosDeleteMaterial(id))
  }
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
  sortOrder?: number
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
    sortOrder: input.sortOrder ?? 0,
    updatedAt: now,
  })
}

/** Persistiert eine neue Anzeigereihenfolge ohne sonstige Felder zu überschreiben. */
export async function reorderMaterials(
  orderedIds: string[]
): Promise<MaterialItem[]> {
  const updated: MaterialItem[] = []
  for (let index = 0; index < orderedIds.length; index++) {
    const id = orderedIds[index]!
    const current = await getMaterialById(id)
    if (!current) continue
    if ((current.sortOrder ?? 0) === index) {
      updated.push(current)
      continue
    }
    updated.push(await upsertMaterial({ ...current, sortOrder: index }))
  }
  return updated
}
