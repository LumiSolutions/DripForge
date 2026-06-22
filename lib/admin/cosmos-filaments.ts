import { getSettingsContainer } from "@/lib/cosmos/client"
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

/** Legacy-Filament-Dokumente (docType filament) — nur noch für Shop-Material-Merge. */
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
