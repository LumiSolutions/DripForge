import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  mergeSiteTexts,
  sanitizeSiteTextsInput,
  SITE_TEXT_DOC_TYPE,
  SITE_TEXTS_DOC_ID,
  type SiteTexts,
} from "@/lib/admin/site-texts"

type SiteTextsCosmosDoc = {
  id: string
  docType: string
  texts: Partial<Record<string, string>>
  updatedAt: string
}

export async function cosmosGetSiteTexts(): Promise<SiteTexts> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(SITE_TEXTS_DOC_ID, SITE_TEXTS_DOC_ID)
      .read<SiteTextsCosmosDoc>()
    if (resource?.docType === SITE_TEXT_DOC_TYPE) {
      return mergeSiteTexts(resource.texts)
    }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 404) {
      logCosmosError("cosmosGetSiteTexts", error)
      throw error
    }
  }
  return mergeSiteTexts(null)
}

export async function cosmosSaveSiteTexts(texts: SiteTexts): Promise<SiteTexts> {
  const container = await getSettingsContainer()
  const sanitized = sanitizeSiteTextsInput(texts)
  const doc: SiteTextsCosmosDoc = {
    id: SITE_TEXTS_DOC_ID,
    docType: SITE_TEXT_DOC_TYPE,
    texts: sanitized,
    updatedAt: new Date().toISOString(),
  }
  await container.items.upsert(doc)
  return sanitized
}
