import {
  getSiteConfigProduction,
  getSiteConfigStaging,
} from "@/lib/admin/db"
import { findCustomCmsPageByPath, type CmsPageEntry } from "@/lib/admin/site-nav"
import { buildUeberUnsPageTemplate } from "@/lib/admin/cms-page-templates"
import { CmsCustomPageView } from "@/components/dripforge/views/cms-custom-page-view"
import { UeberUnsContactSection } from "@/components/dripforge/ueber-uns-contact-section"

type PageProps = {
  searchParams: Promise<{ preview?: string; staging?: string }>
}

export const metadata = {
  title: "Über DripForge – Präzision trifft Leidenschaft | DripForge",
  description: "Vom digitalen Entwurf zum greifbaren Unikat.",
}

/**
 * Entfernt CMS-Contact-/CTA-Blöcke, damit das Formular exakt einmal
 * über UeberUnsContactSection gerendert wird (kein Doppel-Render).
 */
function withoutEmbeddedContact(page: CmsPageEntry): CmsPageEntry {
  const blocks = (page.blocks ?? []).filter(
    (block) => block.type !== "contact" && block.type !== "cta"
  )
  const usedRowIds = new Set(blocks.map((block) => block.rowId).filter(Boolean))
  const rows = (page.rows ?? []).filter((row) => usedRowIds.has(row.id))
  return { ...page, blocks, rows }
}

export default async function UeberUnsPage({ searchParams }: PageProps) {
  const query = await searchParams
  const preview = query.preview === "1" || query.staging === "1"
  const bundle = preview
    ? await getSiteConfigStaging()
    : await getSiteConfigProduction()
  const page = withoutEmbeddedContact(
    findCustomCmsPageByPath(bundle.pages, "/ueber-uns", {
      includeDrafts: preview,
    }) ?? buildUeberUnsPageTemplate()
  )

  return (
    <>
      <CmsCustomPageView page={page} />
      <UeberUnsContactSection />
    </>
  )
}
