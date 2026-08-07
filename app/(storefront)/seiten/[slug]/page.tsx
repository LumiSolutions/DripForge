import { notFound } from "next/navigation"
import {
  getSiteConfigProduction,
  getSiteConfigStaging,
} from "@/lib/admin/db"
import { findCustomCmsPageBySlug } from "@/lib/admin/site-nav"
import { CmsCustomPageView } from "@/components/dripforge/views/cms-custom-page-view"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string; staging?: string }>
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const { slug } = await params
  const query = await searchParams
  const preview = query.preview === "1" || query.staging === "1"
  const bundle = preview
    ? await getSiteConfigStaging()
    : await getSiteConfigProduction()
  const page = findCustomCmsPageBySlug(bundle.pages, slug, {
    includeDrafts: preview,
  })
  if (!page) return { title: "Seite nicht gefunden | DripForge" }
  return {
    title: `${page.heroTitle?.trim() || page.title} | DripForge`,
    description: page.heroSubtitle?.trim() || undefined,
  }
}

export default async function CustomCmsPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const query = await searchParams
  const preview = query.preview === "1" || query.staging === "1"
  const bundle = preview
    ? await getSiteConfigStaging()
    : await getSiteConfigProduction()
  const page = findCustomCmsPageBySlug(bundle.pages, slug, {
    includeDrafts: preview,
  })

  if (!page) notFound()

  return <CmsCustomPageView page={page} />
}
