import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  KONTAKTANFRAGE_DOC_TYPE,
  type Kontaktanfrage,
} from "@/lib/admin/kontaktanfrage-types"

export async function cosmosSaveKontaktanfrage(
  anfrage: Kontaktanfrage
): Promise<Kontaktanfrage> {
  const container = await getSettingsContainer()
  await container.items.upsert({ ...anfrage, id: anfrage.id })
  return anfrage
}

export async function cosmosGetKontaktanfrageById(
  id: string
): Promise<Kontaktanfrage | null> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container.item(id, id).read<Kontaktanfrage>()
    if (!resource || resource.docType !== KONTAKTANFRAGE_DOC_TYPE) return null
    return resource
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetKontaktanfrageById:${id}`, error)
    throw error
  }
}
