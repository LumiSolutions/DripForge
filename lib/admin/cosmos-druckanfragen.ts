import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  DRUCKANFRAGE_DOC_TYPE,
  type Druckanfrage,
} from "@/lib/admin/druckanfrage-types"

export async function cosmosSaveDruckanfrage(anfrage: Druckanfrage): Promise<Druckanfrage> {
  const container = await getSettingsContainer()
  await container.items.upsert({ ...anfrage, id: anfrage.id })
  return anfrage
}

export async function cosmosListDruckanfragen(limit = 100): Promise<Druckanfrage[]> {
  const container = await getSettingsContainer()
  const { resources } = await container.items
    .query<Druckanfrage>({
      query:
        "SELECT * FROM c WHERE c.docType = @docType ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit",
      parameters: [
        { name: "@docType", value: DRUCKANFRAGE_DOC_TYPE },
        { name: "@limit", value: limit },
      ],
    })
    .fetchAll()
  return resources
}

export async function cosmosGetDruckanfrageById(id: string): Promise<Druckanfrage | null> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container.item(id, id).read<Druckanfrage>()
    if (!resource || resource.docType !== DRUCKANFRAGE_DOC_TYPE) return null
    return resource
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetDruckanfrageById:${id}`, error)
    throw error
  }
}
