import {
  SITE_CONFIG_PREVIEW_PARAM,
  SITE_CONFIG_READONLY_PARAM,
} from "@/lib/admin/site-config"
import { SHOP_ROUTES } from "@/lib/dripforge/shop-routes"

export type CmsPreviewPage = {
  id: string
  label: string
  path: string
}

/** Seiten/Abschnitte für CMS-Navigation (Preview-Modus bleibt erhalten). */
export const CMS_PREVIEW_PAGES: CmsPreviewPage[] = [
  { id: "home", label: "Home", path: SHOP_ROUTES.home },
  { id: "shop", label: "Shop", path: SHOP_ROUTES.shop },
  { id: "3d-druck", label: "3D-Druck", path: SHOP_ROUTES["3d-druck"] },
  { id: "laser", label: "Laser", path: SHOP_ROUTES.laser },
  { id: "kontakt", label: "Kontakt", path: SHOP_ROUTES.kontakt },
  { id: "faq", label: "FAQ", path: SHOP_ROUTES.faq },
  { id: "ai", label: "KI-Konfigurator", path: SHOP_ROUTES.aiKonfigurator },
  { id: "support", label: "Support", path: SHOP_ROUTES.support },
  {
    id: "konfigurator-3d",
    label: "Konfigurator 3D",
    path: SHOP_ROUTES.konfigurator3d,
  },
  {
    id: "konfigurator-laser",
    label: "Konfigurator Laser",
    path: SHOP_ROUTES.konfiguratorLaser,
  },
  { id: "impressum", label: "Impressum", path: SHOP_ROUTES.impressum },
  { id: "agb", label: "AGB", path: SHOP_ROUTES.agb },
  { id: "datenschutz", label: "Datenschutz", path: SHOP_ROUTES.datenschutz },
]

function withPreviewParams(
  path: string,
  options?: { readonly?: boolean }
): string {
  const normalized = path === "/" ? "/" : path.replace(/\/+$/, "") || "/"
  const url = new URL(normalized, "https://dripforge.local")
  url.searchParams.set(SITE_CONFIG_PREVIEW_PARAM, "true")
  if (options?.readonly) {
    url.searchParams.set(SITE_CONFIG_READONLY_PARAM, "1")
  } else {
    url.searchParams.set(SITE_CONFIG_READONLY_PARAM, "0")
  }
  return `${url.pathname}${url.search}`
}

/** In-Context-Editor: Staging + Inline-Edit (readonly aus). */
export function cmsPreviewHref(path: string): string {
  return withPreviewParams(path, { readonly: false })
}

/** Test-Umgebung: Staging ohne Bearbeitungswerkzeuge. */
export function cmsReadonlyPreviewHref(path: string): string {
  return withPreviewParams(path, { readonly: true })
}
