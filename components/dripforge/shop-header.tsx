"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { SafeLink } from "@/components/dripforge/safe-link"
import { safeNavigate } from "@/lib/dripforge/safe-navigate"
import { safeLocalGet, safeLocalSet } from "@/lib/dripforge/safe-storage"
import {
  Box,
  Menu,
  Moon,
  Search,
  ShoppingBag,
  Sun,
  User,
  X,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  filterNavItems,
  isLaserNavVisible,
  isShopNavVisible,
  normalizeServiceVisibility,
} from "@/lib/dripforge/service-visibility"
import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import { shopCartHref, shopNavHref } from "@/lib/dripforge/shop-routes"
import { prefetchProductCovers } from "@/components/dripforge/shared/shop-image-prefetch"
import { HEADER_ICON_BTN_CLASS } from "@/components/dripforge/support-nav-link"
import { BrandIconImage } from "@/components/dripforge/brand-icon-image"
import { EditableCmsNavLabel } from "@/components/dripforge/editable-cms-nav-label"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import { useCustomerCategory } from "@/components/dripforge/customer-category-provider"
import { calculateProductPrice } from "@/lib/dripforge/calculate-product-price"
import { cmsPreviewHref, cmsReadonlyPreviewHref } from "@/lib/admin/cms-preview-pages"
import {
  ThemeInboundTour,
  useThemeInboundTourVisible,
} from "@/components/dripforge/theme-inbound-tour"
import { markThemeInboundTourSeen } from "@/lib/dripforge/theme-inbound-tour-settings"
import { resolveCmsNavIcon } from "@/lib/admin/cms-nav-icons"
import { resolveVisibleCmsNavItems, type CmsNavItem } from "@/lib/admin/site-nav"
import type { Product } from "@/lib/dripforge/types"
import { normalizeShopProduct } from "@/lib/dripforge/normalize-shop-product"
import { productHref } from "@/lib/dripforge/product-slug"

type SpaNavProps = {
  mode: "spa"
  currentView: string
  onNavigate: (view: string) => void
  cartCount: number
  onOpenShop?: () => void
}

type LinkNavProps = {
  mode: "link"
  cartCount?: number
}

export type ShopHeaderProps = SpaNavProps | LinkNavProps

function applyServiceVisibilityToCmsNav(
  items: CmsNavItem[],
  services: ServiceVisibilitySettings
): CmsNavItem[] {
  return items.filter((item) => {
    if (item.id === "3d-druck") return services.druck3d
    if (item.id === "laser") return isLaserNavVisible(services)
    if (item.id === "shop") return isShopNavVisible(services)
    return true
  })
}

export function ShopHeader(props: ShopHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { navItems: cmsNavItems, preview, readonly } = useSiteTexts()
  const customerCategory = useCustomerCategory()

  const withPreviewHref = (href: string) => {
    if (!preview) return href
    return readonly ? cmsReadonlyPreviewHref(href) : cmsPreviewHref(href)
  }
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [services, setServices] = useState<ServiceVisibilitySettings>(
    normalizeServiceVisibility(null)
  )
  const [kontoLoggedIn, setKontoLoggedIn] = useState(false)
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const themeButtonRef = useRef<HTMLButtonElement>(null)
  const themeTourVisible = useThemeInboundTourVisible()

  const cartCount = props.mode === "spa" ? props.cartCount : (props.cartCount ?? 0)
  const kontoActive =
    props.mode === "link" ? pathname.startsWith("/konto") : false
  const kontoHref = kontoLoggedIn ? "/konto" : "/konto/login"

  useEffect(() => {
    const savedTheme = safeLocalGet("theme") as "light" | "dark" | null
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light")
    setTheme(initialTheme)
    document.documentElement.classList.toggle("dark", initialTheme === "dark")
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    void fetch("/api/settings/services")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setServices(normalizeServiceVisibility(data))
      })
      .catch(() => {
        console.warn("Navigation: Service-Sichtbarkeit konnte nicht geladen werden.")
      })
  }, [])

  useEffect(() => {
    void fetch("/api/konto/me", { cache: "no-store" })
      .then((res) => setKontoLoggedIn(res.ok))
      .catch(() => setKontoLoggedIn(false))
  }, [pathname])

  useEffect(() => {
    if (!searchOpen || catalogLoaded) return
    let cancelled = false
    void fetch("/api/products", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data?.products)
          ? (data.products as Product[]).map(normalizeShopProduct)
          : []
        setCatalogProducts(list)
        setCatalogLoaded(true)
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogProducts([])
          setCatalogLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [searchOpen, catalogLoaded])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
        setSearchQuery("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const toggleTheme = () => {
    if (themeTourVisible) {
      markThemeInboundTourSeen()
    }
    setTheme((prev) => {
      const newTheme = prev === "dark" ? "light" : "dark"
      safeLocalSet("theme", newTheme)
      return newTheme
    })
  }

  const visibleCmsNav = useMemo(() => {
    const fromConfig = resolveVisibleCmsNavItems(cmsNavItems)
    return applyServiceVisibilityToCmsNav(fromConfig, services)
  }, [cmsNavItems, services])

  const fallbackNavItems = filterNavItems(services)
  const useCmsNav = visibleCmsNav.length > 0

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    // /api/products liefert nur active/sale — inaktive sind nie enthalten
    return catalogProducts.filter(
      (p) =>
        p.istAktiv !== false &&
        (p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q))
    )
  }, [catalogProducts, searchQuery])

  const isNavActive = (viewId: string, href?: string) => {
    if (props.mode === "spa") return props.currentView === viewId
    const target = href ?? shopNavHref(viewId)
    if (target === "/") return pathname === "/"
    return pathname === target || pathname.startsWith(`${target}/`)
  }

  const handleSpaNav = (viewId: string) => {
    if (props.mode !== "spa") return
    props.onNavigate(viewId)
    setMobileMenuOpen(false)
    setSearchOpen(false)
    setSearchQuery("")
  }

  const prefetchShopCatalogImages = () => {
    if (catalogProducts.length > 0) prefetchProductCovers(catalogProducts)
  }

  const logo = (
    <>
      <BrandIconImage size={32} />
      <span className="text-xl font-bold">
        <span className="text-primary">Drip</span>
        <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
          Forge
        </span>
      </span>
    </>
  )

  const navLinkClass = (active: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4",
      active
        ? "bg-secondary text-foreground"
        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
    )

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 z-[100]",
          "top-[var(--df-banner-h,0px)]",
          "border-b border-border/60 bg-background/95 shadow-sm backdrop-blur-md",
          "supports-[backdrop-filter]:bg-background/90"
        )}
      >
      <div className="mx-auto flex h-[var(--header-height,4rem)] max-w-7xl flex-nowrap items-center gap-2 px-3 sm:gap-4 sm:px-4">
        {props.mode === "spa" ? (
          <button
            type="button"
            onClick={() => handleSpaNav("home")}
            className="relative z-20 flex min-w-0 shrink items-center gap-2 pr-1 sm:shrink-0 sm:pr-4"
          >
            {logo}
          </button>
        ) : (
          <SafeLink
            href={withPreviewHref("/")}
            className="relative z-20 flex min-w-0 shrink items-center gap-2 pr-1 sm:shrink-0 sm:pr-4"
          >
            {logo}
          </SafeLink>
        )}

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex">
          {useCmsNav
            ? visibleCmsNav.map((item) => {
                const Icon = resolveCmsNavIcon(item.icon)
                const href = withPreviewHref(item.href || shopNavHref(item.id))
                if (props.mode === "spa") {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSpaNav(item.id)}
                      className={navLinkClass(isNavActive(item.id, href))}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <EditableCmsNavLabel navId={item.id} label={item.label} />
                    </button>
                  )
                }
                return (
                  <SafeLink
                    key={item.id}
                    href={href}
                    className={navLinkClass(isNavActive(item.id, href))}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <EditableCmsNavLabel navId={item.id} label={item.label} />
                  </SafeLink>
                )
              })
            : fallbackNavItems.map((item) =>
                props.mode === "spa" ? (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSpaNav(item.id)}
                    className={navLinkClass(isNavActive(item.id))}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                ) : (
                  <SafeLink
                    key={item.id}
                    href={withPreviewHref(shopNavHref(item.id))}
                    className={navLinkClass(isNavActive(item.id))}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </SafeLink>
                )
              )}
        </nav>

        <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-3 md:gap-5">
          <button
            ref={themeButtonRef}
            type="button"
            onClick={toggleTheme}
            className={cn(
              HEADER_ICON_BTN_CLASS,
              themeTourVisible && "relative z-[310]"
            )}
            title={theme === "dark" ? "Light Mode" : "Dark Mode"}
            aria-label={theme === "dark" ? "Light Mode aktivieren" : "Dark Mode aktivieren"}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <div ref={searchRef} className="relative">
              {searchOpen ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/80 px-3 py-1.5">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Produkte suchen..."
                    className="w-48 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setSearchOpen(false)
                        setSearchQuery("")
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false)
                      setSearchQuery("")
                    }}
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className={HEADER_ICON_BTN_CLASS}
                  title="Suchen"
                >
                  <Search className="h-5 w-5" />
                </button>
              )}

              {searchOpen && searchQuery.trim().length > 0 && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-background shadow-xl">
                  {searchResults.length > 0 ? (
                    <>
                      <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                        {searchResults.length} Ergebnis
                        {searchResults.length !== 1 ? "se" : ""}
                      </p>
                      <ul>
                        {searchResults.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => {
                                if (props.mode === "spa") {
                                  props.onNavigate("shop")
                                } else {
                                  safeNavigate(productHref(p, catalogProducts), {
                                    routerPush: (to) => router.push(to),
                                  })
                                }
                                setSearchOpen(false)
                                setSearchQuery("")
                              }}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60"
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                {p.type === "3d" ? (
                                  <Box className="h-4 w-4 text-primary" />
                                ) : (
                                  <Zap className="h-4 w-4 text-cyan-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{p.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {p.type === "3d" ? "3D-Druck" : "Lasergravur"} · CHF{" "}
                                  {(() => {
                                    const priced = calculateProductPrice({
                                      price: p.price,
                                      originalPrice: p.originalPrice,
                                      sale: p.sale,
                                      categoryDiscountPercent:
                                        customerCategory.loaded
                                          ? customerCategory.discountPercent
                                          : 0,
                                    })
                                    return (
                                      <>
                                        {priced.unitPrice.toFixed(2)}
                                        {priced.strikePrice != null &&
                                        priced.strikePrice >
                                          priced.unitPrice + 0.001 ? (
                                          <span className="ml-1 line-through opacity-70">
                                            {priced.strikePrice.toFixed(2)}
                                          </span>
                                        ) : null}
                                      </>
                                    )
                                  })()}
                                </p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Keine Produkte gefunden
                    </div>
                  )}
                </div>
              )}
            </div>

          {props.mode === "spa" ? (
            <Button
              onClick={() => props.onOpenShop?.() ?? props.onNavigate("shop")}
              onMouseEnter={prefetchShopCatalogImages}
              onFocus={prefetchShopCatalogImages}
              className="hidden bg-primary text-primary-foreground hover:bg-primary/90 md:flex"
            >
              Jetzt Erstellen
            </Button>
          ) : (
            <Button asChild className="hidden bg-primary text-primary-foreground hover:bg-primary/90 md:flex">
              <SafeLink
                href={shopNavHref("shop")}
                onMouseEnter={prefetchShopCatalogImages}
                onFocus={prefetchShopCatalogImages}
              >
                Jetzt Erstellen
              </SafeLink>
            </Button>
          )}

          <SafeLink
            href={kontoHref}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-1 py-1.5 text-sm font-medium transition-colors sm:gap-2 sm:px-2",
              kontoActive || (props.mode === "spa" && kontoLoggedIn)
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
            title={kontoLoggedIn ? "Mein Konto" : "Anmelden oder registrieren"}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                kontoActive || kontoLoggedIn
                  ? "border-primary/40 bg-primary/15"
                  : "border-border/80 bg-secondary/50"
              )}
            >
              <User
                className={cn(
                  "h-4 w-4",
                  kontoActive || kontoLoggedIn
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              />
            </span>
            <span className="hidden lg:inline">Mein Konto</span>
          </SafeLink>

          {props.mode === "spa" ? (
            <button
              type="button"
              onClick={() => props.onNavigate("warenkorb")}
              className={cn(HEADER_ICON_BTN_CLASS, "relative hover:text-primary")}
              title="Warenkorb"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </button>
          ) : (
            <SafeLink
              href={shopCartHref()}
              forceHard
              className={cn(HEADER_ICON_BTN_CLASS, "relative hover:text-primary")}
              title="Warenkorb"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </SafeLink>
          )}

          <button
            type="button"
            className={cn(HEADER_ICON_BTN_CLASS, "md:hidden")}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Menü schliessen" : "Menü öffnen"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="max-h-[calc(100dvh-var(--header-height,4rem))] overflow-y-auto overscroll-contain border-t border-border bg-background/98 p-4 shadow-md backdrop-blur-md touch-pan-y md:hidden landscape:max-h-[calc(100dvh-3.5rem)]">
          <nav className="flex min-h-0 flex-col gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {useCmsNav
              ? visibleCmsNav.map((item) => {
                  const Icon = resolveCmsNavIcon(item.icon)
                  const href = item.href || shopNavHref(item.id)
                  if (props.mode === "spa") {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSpaNav(item.id)}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors touch-manipulation",
                          isNavActive(item.id, href)
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <EditableCmsNavLabel navId={item.id} label={item.label} />
                      </button>
                    )
                  }
                  return (
                    <SafeLink
                      key={item.id}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors touch-manipulation",
                        isNavActive(item.id, href)
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <EditableCmsNavLabel navId={item.id} label={item.label} />
                    </SafeLink>
                  )
                })
              : fallbackNavItems.map((item) =>
                  props.mode === "spa" ? (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSpaNav(item.id)}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors touch-manipulation",
                        isNavActive(item.id)
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </button>
                  ) : (
                    <SafeLink
                      key={item.id}
                      href={shopNavHref(item.id)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors touch-manipulation",
                        isNavActive(item.id)
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </SafeLink>
                  )
                )}
            <SafeLink
              href={kontoHref}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg border border-primary/20 px-4 py-3 text-sm font-medium touch-manipulation",
                kontoActive || kontoLoggedIn
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50"
              )}
            >
              <User className="h-5 w-5" />
              Mein Konto
            </SafeLink>
          </nav>
        </div>
      )}
      <ThemeInboundTour anchorRef={themeButtonRef} onThemeChange={setTheme} />
      </header>
      {/* Platzhalter: verhindert, dass Content unter Banner + fixed Header verschwindet */}
      <div
        className="h-[calc(var(--header-height,4rem)+var(--df-banner-h,0px))] shrink-0"
        aria-hidden="true"
      />
    </>
  )
}
