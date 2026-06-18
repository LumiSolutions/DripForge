/** Feste Storefront-Routen (keine ?view= Query-Parameter mehr). */
export const SHOP_ROUTES = {
  home: "/",
  "3d-druck": "/3d-druck",
  laser: "/laser",
  shop: "/shop",
  kontakt: "/kontakt",
  support: "/support",
  warenkorb: "/warenkorb",
  checkout: "/checkout",
  faq: "/faq",
  impressum: "/impressum",
  agb: "/agb",
  datenschutz: "/datenschutz",
  aiKonfigurator: "/konfigurator/ai",
  konfigurator3d: "/konfigurator/3d-druck",
  konfiguratorLaser: "/konfigurator/laser",
} as const

const VIEW_TO_PATH: Record<string, string> = {
  home: SHOP_ROUTES.home,
  "3d-druck": SHOP_ROUTES["3d-druck"],
  "individual-3d": SHOP_ROUTES.konfigurator3d,
  laser: SHOP_ROUTES.laser,
  "individual-laser": SHOP_ROUTES.konfiguratorLaser,
  shop: SHOP_ROUTES.shop,
  kontakt: SHOP_ROUTES.kontakt,
  support: SHOP_ROUTES.support,
  warenkorb: SHOP_ROUTES.warenkorb,
  checkout: SHOP_ROUTES.checkout,
  faq: SHOP_ROUTES.faq,
  impressum: SHOP_ROUTES.impressum,
  agb: SHOP_ROUTES.agb,
  datenschutz: SHOP_ROUTES.datenschutz,
  "ai-konfigurator": SHOP_ROUTES.aiKonfigurator,
}

export function shopViewHref(viewId: string): string {
  return VIEW_TO_PATH[viewId] ?? SHOP_ROUTES.home
}

export function shopCartHref(): string {
  return SHOP_ROUTES.warenkorb
}

export function shopNavHref(navId: string): string {
  return VIEW_TO_PATH[navId] ?? SHOP_ROUTES.home
}
