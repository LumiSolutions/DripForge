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
  mergeSiteImages,
  sanitizeSiteImagesInput,
  type SiteImages,
} from "@/lib/admin/site-images"
import {
  mergeSiteLinks,
  sanitizeSiteLinksInput,
  type SiteLinks,
} from "@/lib/admin/site-links"
import {
  mergeSiteTexts,
  sanitizeSiteTextsInput,
  SITE_TEXT_DOC_TYPE,
  type SiteTexts,
} from "@/lib/admin/site-texts"
import {
  mergeCmsFaqItems,
  sanitizeCmsFaqItemsInput,
  type CmsFaqItem,
} from "@/lib/admin/cms-faq"
import {
  mergeCmsNavItems,
  mergeCmsPages,
  sanitizeCmsNavItemsInput,
  type CmsNavItem,
  type CmsPageEntry,
} from "@/lib/admin/site-nav"

export type SiteConfigBundle = {
  texts: SiteTexts
  images: SiteImages
  links: SiteLinks
  navItems: CmsNavItem[]
  pages: CmsPageEntry[]
  faqItems: CmsFaqItem[]
}

type SiteConfigCosmosDoc = {
  id: string
  docType: string
  environment: SiteConfigEnvironment
  texts: Partial<Record<string, string>>
  images?: Partial<Record<string, unknown>>
  links?: SiteLinks
  navItems?: CmsNavItem[]
  pages?: CmsPageEntry[]
  faqItems?: CmsFaqItem[]
  updatedAt: string
}

function docIdForEnvironment(environment: SiteConfigEnvironment): string {
  return environment === "staging" ? SITE_CONFIG_STAGING_ID : SITE_CONFIG_PRODUCTION_ID
}

function bundleFromDoc(doc: SiteConfigCosmosDoc | null): SiteConfigBundle | null {
  if (!doc) return null
  const texts = mergeSiteTexts(doc.texts)
  return {
    texts,
    images: mergeSiteImages(doc.images),
    links: mergeSiteLinks(doc.links),
    navItems: mergeCmsNavItems(doc.navItems),
    pages: mergeCmsPages(doc.pages),
    faqItems: mergeCmsFaqItems(doc.faqItems, texts),
  }
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
  bundle: SiteConfigBundle
): Promise<SiteConfigBundle> {
  const container = await getSettingsContainer()
  const texts = sanitizeSiteTextsInput(bundle.texts)
  const images = sanitizeSiteImagesInput(bundle.images)
  const links = sanitizeSiteLinksInput(bundle.links)
  const navItems = sanitizeCmsNavItemsInput(bundle.navItems)
  const pages = mergeCmsPages(bundle.pages)
  const faqItems = sanitizeCmsFaqItemsInput(bundle.faqItems)
  const doc: SiteConfigCosmosDoc = {
    id: docIdForEnvironment(environment),
    docType: SITE_CONFIG_DOC_TYPE,
    environment,
    texts,
    images,
    links,
    navItems,
    pages,
    faqItems,
    updatedAt: new Date().toISOString(),
  }
  await container.items.upsert(doc)
  return { texts, images, links, navItems, pages, faqItems }
}

export async function cosmosGetSiteConfigProduction(): Promise<SiteConfigBundle> {
  const production = await readSiteConfigDoc(SITE_CONFIG_PRODUCTION_ID, SITE_CONFIG_DOC_TYPE)
  const fromDoc = bundleFromDoc(production)
  if (fromDoc) return fromDoc

  const legacy = await readLegacySiteTextsDoc()
  if (legacy) {
    const texts = mergeSiteTexts(legacy)
    const migrated: SiteConfigBundle = {
      texts,
      images: mergeSiteImages(null),
      links: mergeSiteLinks(null),
      navItems: mergeCmsNavItems(null),
      pages: mergeCmsPages(null),
      faqItems: mergeCmsFaqItems(null, texts),
    }
    await upsertSiteConfigDoc("production", migrated)
    return migrated
  }

  const texts = mergeSiteTexts(null)
  return {
    texts,
    images: mergeSiteImages(null),
    links: mergeSiteLinks(null),
    navItems: mergeCmsNavItems(null),
    pages: mergeCmsPages(null),
    faqItems: mergeCmsFaqItems(null, texts),
  }
}

export async function cosmosGetSiteConfigStaging(): Promise<SiteConfigBundle> {
  const staging = await readSiteConfigDoc(SITE_CONFIG_STAGING_ID, SITE_CONFIG_DOC_TYPE)
  const fromDoc = bundleFromDoc(staging)
  if (fromDoc) return fromDoc

  return cosmosGetSiteConfigProduction()
}

export async function cosmosSaveSiteConfigStaging(
  bundle: SiteConfigBundle
): Promise<SiteConfigBundle> {
  return upsertSiteConfigDoc("staging", bundle)
}

export async function cosmosPublishSiteConfig(): Promise<SiteConfigBundle> {
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
