import { getInventoryContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  DEFAULT_INVENTORY_MATERIALS,
  type StoredInventoryMaterial,
} from "@/lib/admin/inventory-types"

type CosmosDoc<T> = T & { id: string }

function stripCosmosId<T extends { id?: string }>(doc: T): Omit<T, "id"> {
  const { id: _id, ...rest } = doc
  return rest
}

export async function cosmosGetInventoryMaterials(): Promise<
  StoredInventoryMaterial[]
> {
  const container = await getInventoryContainer()
  const { resources } = await container.items
    .query<CosmosDoc<StoredInventoryMaterial>>(
      "SELECT * FROM c ORDER BY c.name ASC"
    )
    .fetchAll()

  if (resources.length > 0) {
    return resources.map((doc) => {
      const { id, name, bestand, mindestbestand, einheit, lieferant, updatedAt } =
        doc
      return { id, name, bestand, mindestbestand, einheit, lieferant, updatedAt }
    })
  }

  const now = new Date().toISOString()
  const seeded = DEFAULT_INVENTORY_MATERIALS.map((m) => ({
    ...m,
    updatedAt: now,
  }))

  for (const material of seeded) {
    await container.items.upsert({ ...material, id: material.id })
  }
  return seeded
}

export async function cosmosGetInventoryMaterialById(
  id: string
): Promise<StoredInventoryMaterial | null> {
  const container = await getInventoryContainer()
  try {
    const { resource: doc } = await container
      .item(id, id)
      .read<CosmosDoc<StoredInventoryMaterial>>()
    if (!doc) return null
    return {
      id: doc.id,
      name: doc.name,
      bestand: doc.bestand,
      mindestbestand: doc.mindestbestand,
      einheit: doc.einheit,
      lieferant: doc.lieferant,
      updatedAt: doc.updatedAt,
    }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetInventoryMaterialById:${id}`, error)
    throw error
  }
}

export async function cosmosUpsertInventoryMaterial(
  material: StoredInventoryMaterial
): Promise<StoredInventoryMaterial> {
  const container = await getInventoryContainer()
  await container.items.upsert({ ...material, id: material.id })
  return material
}

export async function cosmosDeleteInventoryMaterial(id: string): Promise<boolean> {
  const container = await getInventoryContainer()
  try {
    await container.item(id, id).delete()
    return true
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return false
    throw error
  }
}
