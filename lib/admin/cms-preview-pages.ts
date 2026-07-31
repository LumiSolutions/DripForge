import { SITE_CONFIG_PREVIEW_PARAM } from "@/lib/admin/site-config"
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
]

export function cmsPreviewHref(path: string): string {
  const normalized = path === "/" ? "/" : path.replace(/\/+$/, "") || "/"
  const sep = normalized.includes("?") ? "&" : "?"
  return `${normalized}${sep}${SITE_CONFIG_PREVIEW_PARAM}=true`
}
