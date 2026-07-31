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
    faqItems: existing.faqItems,
    processSteps3d: existing.processSteps3d,
    processStepsLaser: existing.processStepsLaser,
    expectItems3d: existing.expectItems3d,
    expectItemsLaser: existing.expectItemsLaser,
    contactFormFields: existing.contactFormFields,
  })
  return saved.texts
}
