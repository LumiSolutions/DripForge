import { NextResponse } from "next/server"
import {
  getSiteConfigProduction,
  getSiteConfigStaging,
} from "@/lib/admin/db"
import { findCustomCmsPageBySlug } from "@/lib/admin/site-nav"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params
    const url = new URL(request.url)
    const preview =
      url.searchParams.get("preview") === "1" ||
      url.searchParams.get("staging") === "1"

    const bundle = preview
      ? await getSiteConfigStaging()
      : await getSiteConfigProduction()

    const page = findCustomCmsPageBySlug(bundle.pages, slug, {
      includeDrafts: preview,
    })

    if (!page) {
      return NextResponse.json({ error: "Seite nicht gefunden." }, { status: 404 })
    }

    return NextResponse.json({ page })
  } catch (error) {
    console.error("CMS page API: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Seite konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}
