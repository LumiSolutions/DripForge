import {
  cosmosGetSiteConfigProduction,
  cosmosSaveSiteConfigStaging,
} from "@/lib/admin/cosmos-site-config"
import type { SiteTexts } from "@/lib/admin/site-texts"

/** @deprecated Legacy alias — liest Production. */
export async function cosmosGetSiteTexts(): Promise<SiteTexts> {
  return cosmosGetSiteConfigProduction()
}

/** @deprecated Legacy alias — speichert Staging. */
export async function cosmosSaveSiteTexts(texts: SiteTexts): Promise<SiteTexts> {
  return cosmosSaveSiteConfigStaging(texts)
}
