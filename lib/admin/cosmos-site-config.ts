import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  LEGACY_SITE_TEXTS_DOC_ID,
  SITE_CONFIG_DOC_TYPE,
  SITE_CONFIG_PRODUCTION_ID,
  SITE_CONFIG_STAGING_ID,
  type SiteConfigEnvironment,
} from "@/lib/admin/site-config"
import {
  mergeSiteTexts,
  sanitizeSiteTextsInput,
  SITE_TEXT_DOC_TYPE,
  type SiteTexts,
} from "@/lib/admin/site-texts"

type SiteConfigCosmosDoc = {
  id: string
  docType: string
  environment: SiteConfigEnvironment
  texts: Partial<Record<string, string>>
  updatedAt: string
}

function docIdForEnvironment(environment: SiteConfigEnvironment): string {
  return environment === "staging" ? SITE_CONFIG_STAGING_ID : SITE_CONFIG_PRODUCTION_ID
}

async function readSiteConfigDoc(
  id: string,
  expectedDocType: string
): Promise<SiteConfigCosmosDoc | null> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container.item(id, id).read<SiteConfigCosmosDoc>()
    if (resource?.docType === expectedDocType) return resource
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 404) {
      logCosmosError(`readSiteConfigDoc:${id}`, error)
      throw error
    }
  }
  return null
}

async function readLegacySiteTextsDoc(): Promise<Partial<Record<string, string>> | null> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(LEGACY_SITE_TEXTS_DOC_ID, LEGACY_SITE_TEXTS_DOC_ID)
      .read<{ docType?: string; texts?: Partial<Record<string, string>> }>()
    if (resource?.docType === SITE_TEXT_DOC_TYPE && resource.texts) {
      return resource.texts
    }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 404) {
      logCosmosError("readLegacySiteTextsDoc", error)
      throw error
    }
  }
  return null
}

async function upsertSiteConfigDoc(
  environment: SiteConfigEnvironment,
  texts: SiteTexts
): Promise<SiteTexts> {
  const container = await getSettingsContainer()
  const sanitized = sanitizeSiteTextsInput(texts)
  const doc: SiteConfigCosmosDoc = {
    id: docIdForEnvironment(environment),
    docType: SITE_CONFIG_DOC_TYPE,
    environment,
    texts: sanitized,
    updatedAt: new Date().toISOString(),
  }
  await container.items.upsert(doc)
  return sanitized
}

export async function cosmosGetSiteConfigProduction(): Promise<SiteTexts> {
  const production = await readSiteConfigDoc(SITE_CONFIG_PRODUCTION_ID, SITE_CONFIG_DOC_TYPE)
  if (production?.texts) return mergeSiteTexts(production.texts)

  const legacy = await readLegacySiteTextsDoc()
  if (legacy) {
    const migrated = mergeSiteTexts(legacy)
    await upsertSiteConfigDoc("production", migrated)
    return migrated
  }

  return mergeSiteTexts(null)
}

export async function cosmosGetSiteConfigStaging(): Promise<SiteTexts> {
  const staging = await readSiteConfigDoc(SITE_CONFIG_STAGING_ID, SITE_CONFIG_DOC_TYPE)
  if (staging?.texts) return mergeSiteTexts(staging.texts)

  return cosmosGetSiteConfigProduction()
}

export async function cosmosSaveSiteConfigStaging(texts: SiteTexts): Promise<SiteTexts> {
  return upsertSiteConfigDoc("staging", texts)
}

export async function cosmosPublishSiteConfig(): Promise<SiteTexts> {
  const staging = await cosmosGetSiteConfigStaging()
  return upsertSiteConfigDoc("production", staging)
}

export async function cosmosGetSiteConfigMeta(): Promise<{
  stagingUpdatedAt: string | null
  productionUpdatedAt: string | null
}> {
  const staging = await readSiteConfigDoc(SITE_CONFIG_STAGING_ID, SITE_CONFIG_DOC_TYPE)
  const production = await readSiteConfigDoc(SITE_CONFIG_PRODUCTION_ID, SITE_CONFIG_DOC_TYPE)
  return {
    stagingUpdatedAt: staging?.updatedAt ?? null,
    productionUpdatedAt: production?.updatedAt ?? null,
  }
}
