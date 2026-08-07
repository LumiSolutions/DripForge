import {
  getSiteConfigProduction,
  getSiteConfigStaging,
} from "@/lib/admin/db"
import { findCustomCmsPageByPath, type CmsPageEntry } from "@/lib/admin/site-nav"
import { buildUeberUnsPageTemplate } from "@/lib/admin/cms-page-templates"
import { CmsCustomPageView } from "@/components/dripforge/views/cms-custom-page-view"

type PageProps = {
  searchParams: Promise<{ preview?: string; staging?: string }>
}

export const metadata = {
  title: "Über DripForge – Präzision trifft Leidenschaft | DripForge",
  description: "Vom digitalen Entwurf zum greifbaren Unikat.",
}

/** Stellt sicher, dass die Kontaktsektion immer am Ende der Über-uns-Seite steht. */
function withContactSection(page: CmsPageEntry): CmsPageEntry {
  const hasContact = (page.blocks ?? []).some((block) => block.type === "contact")
  if (hasContact) return page

  const template = buildUeberUnsPageTemplate()
  const contactBlock = template.blocks?.find((block) => block.type === "contact")
  const contactRow = template.rows?.find((row) => row.id === contactBlock?.rowId)
  if (!contactBlock || !contactRow) return page

  const rows = [...(page.rows ?? [])]
  const blocks = [...(page.blocks ?? [])].filter((block) => block.type !== "cta")
  const nextSort = Math.max(0, ...rows.map((row) => row.sortOrder)) + 1
  const row = { ...contactRow, sortOrder: nextSort }
  rows.push(row)
  blocks.push({
    ...contactBlock,
    rowId: row.id,
    sortOrder: blocks.length,
  })

  return { ...page, rows, blocks }
}

export default async function UeberUnsPage({ searchParams }: PageProps) {
  const query = await searchParams
  const preview = query.preview === "1" || query.staging === "1"
  const bundle = preview
    ? await getSiteConfigStaging()
    : await getSiteConfigProduction()
  const page = withContactSection(
    findCustomCmsPageByPath(bundle.pages, "/ueber-uns", {
      includeDrafts: preview,
    }) ?? buildUeberUnsPageTemplate()
  )

  return <CmsCustomPageView page={page} />
}
