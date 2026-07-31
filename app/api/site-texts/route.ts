import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import {
  getSiteConfigProduction,
  getSiteConfigStaging,
  saveSiteConfigStaging,
} from "@/lib/admin/db"
import { SITE_CONFIG_PREVIEW_PARAM } from "@/lib/admin/site-config"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { mergeSiteImages } from "@/lib/admin/site-images"
import { mergeSiteLinks } from "@/lib/admin/site-links"
import { mergeCmsNavItems, mergeCmsPages } from "@/lib/admin/site-nav"
import { mergeCmsFaqItems } from "@/lib/admin/cms-faq"
import { getDefaultCmsPageContentLists } from "@/lib/admin/cms-page-content"
import { mergeSiteTexts, sanitizeSiteTextsInput } from "@/lib/admin/site-texts"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    await warmCosmosInfrastructure()
    const preview =
      new URL(request.url).searchParams.get(SITE_CONFIG_PREVIEW_PARAM) === "true"
    const bundle = preview
      ? await getSiteConfigStaging()
      : await getSiteConfigProduction()
    return NextResponse.json(
      {
        texts: bundle.texts,
        images: bundle.images,
        links: bundle.links,
        navItems: bundle.navItems,
        pages: bundle.pages,
        faqItems: bundle.faqItems,
        processSteps3d: bundle.processSteps3d,
        processStepsLaser: bundle.processStepsLaser,
        expectItems3d: bundle.expectItems3d,
        expectItemsLaser: bundle.expectItemsLaser,
        contactFormFields: bundle.contactFormFields,
        preview,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("Site-Texts API: Laden fehlgeschlagen.", error)
    const texts = mergeSiteTexts(null)
    const lists = getDefaultCmsPageContentLists()
    return NextResponse.json(
      {
        texts,
        images: mergeSiteImages(null),
        links: mergeSiteLinks(null),
        navItems: mergeCmsNavItems(null),
        pages: mergeCmsPages(null),
        faqItems: mergeCmsFaqItems(null, texts),
        processSteps3d: lists.processSteps3d,
        processStepsLaser: lists.processStepsLaser,
        expectItems3d: lists.expectItems3d,
        expectItemsLaser: lists.expectItemsLaser,
        contactFormFields: lists.contactFormFields,
        preview: false,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  }
}

export async function PUT(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as { texts?: Partial<Record<string, string>> }
    if (!body.texts || typeof body.texts !== "object") {
      return NextResponse.json({ error: "Text-Daten fehlen." }, { status: 400 })
    }

    const existing = await getSiteConfigStaging()
    const texts = sanitizeSiteTextsInput({ ...existing.texts, ...body.texts })
    const saved = await saveSiteConfigStaging({ texts })
    return NextResponse.json({
      texts: saved.texts,
      images: saved.images,
      links: saved.links,
      navItems: saved.navItems,
      pages: saved.pages,
      faqItems: saved.faqItems,
      processSteps3d: saved.processSteps3d,
      processStepsLaser: saved.processStepsLaser,
      expectItems3d: saved.expectItems3d,
      expectItemsLaser: saved.expectItemsLaser,
      contactFormFields: saved.contactFormFields,
      environment: "staging",
    })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Site-Texts API: Speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Texte konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
