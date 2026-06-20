import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import { normalizeAdminFilament, type AdminFilament } from "@/lib/admin/filament-types"
import { cosmosGetMaterialTypes } from "@/lib/admin/cosmos-material-stats"
import { cosmosGetMaterials } from "@/lib/admin/cosmos-materials"

export const FILAMENT_DOC_TYPE = "filament"

type FilamentCosmosDoc = AdminFilament & {
  docType: string
}

function mapFilamentDoc(
  doc: (FilamentCosmosDoc & { id?: string }) | null | undefined
): AdminFilament | null {
  if (!doc?.id || doc.docType !== FILAMENT_DOC_TYPE) return null
  const { docType: _docType, ...filament } = doc
  return normalizeAdminFilament(filament)
}

export async function cosmosGetFilaments(): Promise<AdminFilament[]> {
  const container = await getSettingsContainer()
  const { resources } = await container.items
    .query<FilamentCosmosDoc>({
      query: `SELECT * FROM c WHERE c.docType = @docType`,
      parameters: [{ name: "@docType", value: FILAMENT_DOC_TYPE }],
    })
    .fetchAll()

  const filaments = resources
    .map((doc) => mapFilamentDoc(doc))
    .filter((f): f is AdminFilament => f != null)

  return filaments
}

export async function cosmosGetFilamentById(
  id: string
): Promise<AdminFilament | null> {
  const trimmed = id?.trim()
  if (!trimmed) return null

  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(trimmed, trimmed)
      .read<FilamentCosmosDoc>()
    return mapFilamentDoc(resource)
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetFilamentById:${trimmed}`, error)
    throw error
  }
}

export async function cosmosUpsertFilament(
  filament: AdminFilament
): Promise<AdminFilament> {
  const container = await getSettingsContainer()
  const doc: FilamentCosmosDoc = {
    ...filament,
    docType: FILAMENT_DOC_TYPE,
  }
  await container.items.upsert(doc)
  return filament
}

export async function cosmosDeleteFilament(id: string): Promise<boolean> {
  const trimmed = id?.trim()
  if (!trimmed) return false

  const container = await getSettingsContainer()
  try {
    await container.item(trimmed, trimmed).delete()
    return true
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return false
    logCosmosError(`cosmosDeleteFilament:${trimmed}`, error)
    throw error
  }
}

export async function cosmosGetFilamentMaterials() {
  const [materialTypes, inventoryItems, adminFilaments] = await Promise.all([
    cosmosGetMaterialTypes(),
    cosmosGetMaterials("filament"),
    cosmosGetFilaments(),
  ])
  const { resolveFilamentMaterialsFromSources } = await import(
    "@/lib/dripforge/filament-catalog"
  )
  return resolveFilamentMaterialsFromSources(
    inventoryItems,
    adminFilaments,
    materialTypes
  )
}
