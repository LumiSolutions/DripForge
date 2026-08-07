import { notFound } from "next/navigation"
import {
  getSiteConfigProduction,
  getSiteConfigStaging,
} from "@/lib/admin/db"
import {
  findCustomCmsPageByPath,
  findCustomCmsPageBySlug,
} from "@/lib/admin/site-nav"
import { isCmsReservedPath, normalizeCmsPagePath } from "@/lib/admin/cms-custom-pages"
import { CmsCustomPageView } from "@/components/dripforge/views/cms-custom-page-view"

type PageProps = {
  params: Promise<{ cmsPath: string[] }>
  searchParams: Promise<{ preview?: string; staging?: string }>
}

async function loadPage(pathSegments: string[], preview: boolean) {
  const path = normalizeCmsPagePath(`/${pathSegments.join("/")}`)
  if (isCmsReservedPath(path) && !path.startsWith("/seiten/")) {
    return null
  }
  const bundle = preview
    ? await getSiteConfigStaging()
    : await getSiteConfigProduction()
  return (
    findCustomCmsPageByPath(bundle.pages, path, { includeDrafts: preview }) ??
    (pathSegments.length === 1
      ? findCustomCmsPageBySlug(bundle.pages, pathSegments[0], {
          includeDrafts: preview,
        })
      : null)
  )
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const { cmsPath } = await params
  const query = await searchParams
  const preview = query.preview === "1" || query.staging === "1"
  const page = await loadPage(cmsPath ?? [], preview)
  if (!page) return { title: "Seite nicht gefunden | DripForge" }
  return {
    title: `${page.heroTitle?.trim() || page.title} | DripForge`,
    description: page.heroSubtitle?.trim() || undefined,
  }
}

export default async function CmsCatchAllPage({
  params,
  searchParams,
}: PageProps) {
  const { cmsPath } = await params
  const query = await searchParams
  const preview = query.preview === "1" || query.staging === "1"
  const page = await loadPage(cmsPath ?? [], preview)
  if (!page) notFound()
  return <CmsCustomPageView page={page} />
}
