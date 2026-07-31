import {
  cosmosGetSiteConfigProduction,
  cosmosGetSiteConfigStaging,
  cosmosSaveSiteConfigStaging,
} from "@/lib/admin/cosmos-site-config"
import type { SiteTexts } from "@/lib/admin/site-texts"

/** @deprecated Legacy alias — liest Production-Texte. */
export async function cosmosGetSiteTexts(): Promise<SiteTexts> {
  const bundle = await cosmosGetSiteConfigProduction()
  return bundle.texts
}

/** @deprecated Legacy alias — speichert Staging-Texte (Bilder bleiben erhalten). */
export async function cosmosSaveSiteTexts(texts: SiteTexts): Promise<SiteTexts> {
  const existing = await cosmosGetSiteConfigStaging()
  const saved = await cosmosSaveSiteConfigStaging({
    texts,
    images: existing.images,
    links: existing.links,
    navItems: existing.navItems,
    pages: existing.pages,
  })
  return saved.texts
}
