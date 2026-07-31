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
import {
  getDefaultExpectItems3d,
  getDefaultExpectItemsLaser,
  getDefaultProcessSteps3d,
  getDefaultProcessStepsLaser,
  sanitizeCmsContactFormFields,
  sanitizeCmsExpectItems,
  sanitizeCmsProcessSteps,
  type CmsContactField,
  type CmsExpectItem,
  type CmsProcessStep,
} from "@/lib/admin/cms-page-content"
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
      processSteps3d: bundle.processSteps3d,
      processStepsLaser: bundle.processStepsLaser,
      expectItems3d: bundle.expectItems3d,
      expectItemsLaser: bundle.expectItemsLaser,
      contactFormFields: bundle.contactFormFields,
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
      processSteps3d?: CmsProcessStep[]
      processStepsLaser?: CmsProcessStep[]
      expectItems3d?: CmsExpectItem[]
      expectItemsLaser?: CmsExpectItem[]
      contactFormFields?: CmsContactField[]
      documentTemplate?: unknown
    }
    const hasTexts = body.texts && typeof body.texts === "object"
    const hasImages = body.images && typeof body.images === "object"
    const hasLinks = body.links && typeof body.links === "object"
    const hasNavItems = Array.isArray(body.navItems)
    const hasPages = Array.isArray(body.pages)
    const hasFaqItems = Array.isArray(body.faqItems)
    const hasProcessSteps3d = Array.isArray(body.processSteps3d)
    const hasProcessStepsLaser = Array.isArray(body.processStepsLaser)
    const hasExpectItems3d = Array.isArray(body.expectItems3d)
    const hasExpectItemsLaser = Array.isArray(body.expectItemsLaser)
    const hasContactFormFields = Array.isArray(body.contactFormFields)
    const hasDocumentTemplate =
      body.documentTemplate && typeof body.documentTemplate === "object"

    if (
      !hasTexts &&
      !hasImages &&
      !hasLinks &&
      !hasNavItems &&
      !hasPages &&
      !hasFaqItems &&
      !hasProcessSteps3d &&
      !hasProcessStepsLaser &&
      !hasExpectItems3d &&
      !hasExpectItemsLaser &&
      !hasContactFormFields &&
      !hasDocumentTemplate
    ) {
      return NextResponse.json(
        {
          error:
            "Text-, Bild-, Link-, Nav-, Seiten-, FAQ-, CMS-Listen- oder Dokumenten-Daten fehlen.",
        },
        { status: 400 }
      )
    }

    const [existing, existingDocumentTemplate] = await Promise.all([
      getSiteConfigStaging(),
      getDocumentTemplateSettings(),
    ])

    const hasBundleFields =
      hasTexts ||
      hasImages ||
      hasLinks ||
      hasNavItems ||
      hasPages ||
      hasFaqItems ||
      hasProcessSteps3d ||
      hasProcessStepsLaser ||
      hasExpectItems3d ||
      hasExpectItemsLaser ||
      hasContactFormFields

    const savedBundle = hasBundleFields
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
          processSteps3d: hasProcessSteps3d
            ? sanitizeCmsProcessSteps(body.processSteps3d, getDefaultProcessSteps3d)
            : existing.processSteps3d,
          processStepsLaser: hasProcessStepsLaser
            ? sanitizeCmsProcessSteps(
                body.processStepsLaser,
                getDefaultProcessStepsLaser
              )
            : existing.processStepsLaser,
          expectItems3d: hasExpectItems3d
            ? sanitizeCmsExpectItems(body.expectItems3d, getDefaultExpectItems3d)
            : existing.expectItems3d,
          expectItemsLaser: hasExpectItemsLaser
            ? sanitizeCmsExpectItems(
                body.expectItemsLaser,
                getDefaultExpectItemsLaser
              )
            : existing.expectItemsLaser,
          contactFormFields: hasContactFormFields
            ? sanitizeCmsContactFormFields(body.contactFormFields)
            : existing.contactFormFields,
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
      processSteps3d: savedBundle.processSteps3d,
      processStepsLaser: savedBundle.processStepsLaser,
      expectItems3d: savedBundle.expectItems3d,
      expectItemsLaser: savedBundle.expectItemsLaser,
      contactFormFields: savedBundle.contactFormFields,
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
