import { promises as fs } from "fs"
import path from "path"
import {
  cosmosDeleteInventoryMaterial,
  cosmosGetInventoryMaterialById,
  cosmosGetInventoryMaterials,
  cosmosUpsertInventoryMaterial,
} from "@/lib/admin/cosmos-inventory"
import {
  DEFAULT_INVENTORY_MATERIALS,
  type InventoryUnit,
  type StoredInventoryMaterial,
} from "@/lib/admin/inventory-types"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import { logCosmosError } from "@/lib/cosmos/log-error"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const INVENTORY_FILE = "inventory.json"

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readInventoryFile(): Promise<StoredInventoryMaterial[]> {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, INVENTORY_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    return JSON.parse(raw) as StoredInventoryMaterial[]
  } catch {
    const now = new Date().toISOString()
    const defaults = DEFAULT_INVENTORY_MATERIALS.map((m) => ({
      ...m,
      updatedAt: now,
    }))
    try {
      await fs.writeFile(filePath, JSON.stringify(defaults, null, 2), "utf-8")
    } catch {
      /* read-only deployment */
    }
    return defaults
  }
}

async function writeInventoryFile(
  materials: StoredInventoryMaterial[]
): Promise<void> {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, INVENTORY_FILE)
  await fs.writeFile(filePath, JSON.stringify(materials, null, 2), "utf-8")
}

export async function getInventoryMaterials(): Promise<StoredInventoryMaterial[]> {
  try {
    return await withCosmosFallback(
      "getInventoryMaterials",
      cosmosGetInventoryMaterials,
      readInventoryFile
    )
  } catch (error) {
    logCosmosError("getInventoryMaterials:total-failure", error)
    return readInventoryFile().catch(() => [])
  }
}

export async function getInventoryMaterialById(
  id: string
): Promise<StoredInventoryMaterial | null> {
  return withCosmosFallback(
    "getInventoryMaterialById",
    () => cosmosGetInventoryMaterialById(id),
    async () => {
      const materials = await readInventoryFile()
      return materials.find((m) => m.id === id) ?? null
    }
  )
}

export async function upsertInventoryMaterial(
  material: StoredInventoryMaterial
): Promise<StoredInventoryMaterial> {
  const next = {
    ...material,
    bestand: Math.max(0, Number(material.bestand) || 0),
    mindestbestand: Math.max(0, Number(material.mindestbestand) || 0),
    updatedAt: new Date().toISOString(),
  }

  await withCosmosFallback(
    "upsertInventoryMaterial",
    async () => {
      await cosmosUpsertInventoryMaterial(next)
    },
    async () => {
      const materials = await readInventoryFile()
      const index = materials.findIndex((m) => m.id === next.id)
      if (index >= 0) materials[index] = next
      else materials.push(next)
      await writeInventoryFile(materials)
    }
  )
  return next
}

export async function adjustInventoryStock(
  id: string,
  delta: number
): Promise<StoredInventoryMaterial | null> {
  const current = await getInventoryMaterialById(id)
  if (!current) return null
  const nextBestand = Math.max(0, current.bestand + delta)
  return upsertInventoryMaterial({ ...current, bestand: nextBestand })
}

export async function deleteInventoryMaterial(id: string): Promise<boolean> {
  const result = await withCosmosFallback(
    "deleteInventoryMaterial",
    async () => cosmosDeleteInventoryMaterial(id),
    async () => {
      const materials = await readInventoryFile()
      const filtered = materials.filter((m) => m.id !== id)
      if (filtered.length === materials.length) return false
      await writeInventoryFile(filtered)
      return true
    }
  )
  return Boolean(result)
}

export function createInventoryMaterialInput(input: {
  name: string
  bestand?: number
  mindestbestand?: number
  einheit?: InventoryUnit
  lieferant?: string
}): StoredInventoryMaterial {
  const slug = input.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  const id = `${slug || "material"}-${Date.now().toString(36)}`

  return {
    id,
    name: input.name.trim(),
    bestand: Math.max(0, Number(input.bestand) || 0),
    mindestbestand: Math.max(0, Number(input.mindestbestand) || 0),
    einheit: input.einheit === "kg" ? "kg" : "Stück",
    lieferant: input.lieferant?.trim() ?? "",
    updatedAt: new Date().toISOString(),
  }
}
