import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import {
  getDocumentTemplateSettings,
  getSiteConfigMeta,
  getSiteConfigStaging,
  saveDocumentTemplateSettings,
  saveSiteConfigStaging,
} from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { sanitizeSiteImagesInput } from "@/lib/admin/site-images"
import { sanitizeSiteLinksInput, type SiteLinks } from "@/lib/admin/site-links"
import {
  mergeCmsPages,
  sanitizeCmsNavItemsInput,
  type CmsNavItem,
  type CmsPageEntry,
} from "@/lib/admin/site-nav"
import {
  sanitizeCmsFaqItemsInput,
  type CmsFaqItem,
} from "@/lib/admin/cms-faq"
import { sanitizeSiteTextsInput } from "@/lib/admin/site-texts"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { sanitizeDocumentTemplateInput } from "@/lib/documents/document-template-types"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const [bundle, meta, documentTemplate] = await Promise.all([
      getSiteConfigStaging(),
      getSiteConfigMeta(),
      getDocumentTemplateSettings(),
    ])
    return NextResponse.json({
      texts: bundle.texts,
      images: bundle.images,
      links: bundle.links,
      navItems: bundle.navItems,
      pages: bundle.pages,
      faqItems: bundle.faqItems,
      meta,
      documentTemplate,
      environment: "staging",
    })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Site-Config: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Texte konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as {
      texts?: Partial<Record<string, string>>
      images?: Partial<Record<string, unknown>>
      links?: Record<string, { href?: string }>
      navItems?: CmsNavItem[]
      pages?: CmsPageEntry[]
      faqItems?: CmsFaqItem[]
      documentTemplate?: unknown
    }
    const hasTexts = body.texts && typeof body.texts === "object"
    const hasImages = body.images && typeof body.images === "object"
    const hasLinks = body.links && typeof body.links === "object"
    const hasNavItems = Array.isArray(body.navItems)
    const hasPages = Array.isArray(body.pages)
    const hasFaqItems = Array.isArray(body.faqItems)
    const hasDocumentTemplate =
      body.documentTemplate && typeof body.documentTemplate === "object"

    if (
      !hasTexts &&
      !hasImages &&
      !hasLinks &&
      !hasNavItems &&
      !hasPages &&
      !hasFaqItems &&
      !hasDocumentTemplate
    ) {
      return NextResponse.json(
        {
          error:
            "Text-, Bild-, Link-, Nav-, Seiten-, FAQ- oder Dokumenten-Daten fehlen.",
        },
        { status: 400 }
      )
    }

    const [existing, existingDocumentTemplate] = await Promise.all([
      getSiteConfigStaging(),
      getDocumentTemplateSettings(),
    ])

    const savedBundle =
      hasTexts || hasImages || hasLinks || hasNavItems || hasPages || hasFaqItems
        ? await saveSiteConfigStaging({
            texts: hasTexts
              ? sanitizeSiteTextsInput({ ...existing.texts, ...body.texts })
              : existing.texts,
            images: hasImages
              ? sanitizeSiteImagesInput({
                  ...existing.images,
                  ...body.images,
                })
              : existing.images,
            links: hasLinks
              ? sanitizeSiteLinksInput({
                  ...existing.links,
                  ...(body.links as SiteLinks),
                })
              : existing.links,
            navItems: hasNavItems
              ? sanitizeCmsNavItemsInput(body.navItems)
              : existing.navItems,
            pages: hasPages ? mergeCmsPages(body.pages) : existing.pages,
            faqItems: hasFaqItems
              ? sanitizeCmsFaqItemsInput(body.faqItems)
              : existing.faqItems,
          })
        : existing

    const savedDocumentTemplate = hasDocumentTemplate
      ? await saveDocumentTemplateSettings(
          sanitizeDocumentTemplateInput(body.documentTemplate, existingDocumentTemplate)
        )
      : existingDocumentTemplate
    const meta = await getSiteConfigMeta()
    return NextResponse.json({
      texts: savedBundle.texts,
      images: savedBundle.images,
      links: savedBundle.links,
      navItems: savedBundle.navItems,
      pages: savedBundle.pages,
      faqItems: savedBundle.faqItems,
      meta,
      documentTemplate: savedDocumentTemplate,
      environment: "staging",
    })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Site-Config: Speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Texte konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
