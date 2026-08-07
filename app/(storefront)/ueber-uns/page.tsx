import {
  getSiteConfigProduction,
  getSiteConfigStaging,
} from "@/lib/admin/db"
import { findCustomCmsPageByPath } from "@/lib/admin/site-nav"
import { buildUeberUnsPageTemplate } from "@/lib/admin/cms-page-templates"
import { CmsCustomPageView } from "@/components/dripforge/views/cms-custom-page-view"

type PageProps = {
  searchParams: Promise<{ preview?: string; staging?: string }>
}

export const metadata = {
  title: "Über DripForge – Präzision trifft Leidenschaft | DripForge",
  description: "Vom digitalen Entwurf zum greifbaren Unikat.",
}

export default async function UeberUnsPage({ searchParams }: PageProps) {
  const query = await searchParams
  const preview = query.preview === "1" || query.staging === "1"
  const bundle = preview
    ? await getSiteConfigStaging()
    : await getSiteConfigProduction()
  const page =
    findCustomCmsPageByPath(bundle.pages, "/ueber-uns", {
      includeDrafts: preview,
    }) ?? buildUeberUnsPageTemplate()

  return <CmsCustomPageView page={page} />
}
