"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Box,
  Heart,
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
import { products } from "@/lib/dripforge/data"
import {
  filterNavItems,
  normalizeServiceVisibility,
} from "@/lib/dripforge/service-visibility"
import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import { shopCartHref, shopNavHref, shopViewHref } from "@/lib/dripforge/shop-routes"
import { SupportMissionLink, SUPPORT_ROUTE, HEADER_ICON_BTN_CLASS } from "@/components/dripforge/support-nav-link"
import { useSupportPageSettings } from "@/hooks/use-support-page-active"

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

export function ShopHeader(props: ShopHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [services, setServices] = useState<ServiceVisibilitySettings>(
    normalizeServiceVisibility(null)
  )
  const [kontoLoggedIn, setKontoLoggedIn] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const cartCount = props.mode === "spa" ? props.cartCount : (props.cartCount ?? 0)
  const kontoActive =
    props.mode === "link" ? pathname.startsWith("/konto") : false
  const supportActive =
    pathname === SUPPORT_ROUTE || pathname.startsWith(`${SUPPORT_ROUTE}/`)
  const { showSupportOnMainSite: supportPageVisible } = useSupportPageSettings()
  const kontoHref = kontoLoggedIn ? "/konto" : "/konto/login"

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light")
    setTheme(initialTheme)
    document.documentElement.classList.toggle("dark", initialTheme === "dark")
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

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
    setTheme((prev) => {
      const newTheme = prev === "dark" ? "light" : "dark"
      localStorage.setItem("theme", newTheme)
      return newTheme
    })
  }

  const visibleNavItems = filterNavItems(services)

  const searchResults =
    searchQuery.trim().length > 0
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : []

  const isNavActive = (viewId: string) => {
    if (props.mode === "spa") return props.currentView === viewId
    const href = shopNavHref(viewId)
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const handleSpaNav = (viewId: string) => {
    if (props.mode !== "spa") return
    props.onNavigate(viewId)
    setMobileMenuOpen(false)
    setSearchOpen(false)
    setSearchQuery("")
  }

  const logo = (
    <>
      <Image
        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2016.%20Mai%202026%2C%2022_19_51-CjFqSwPCG95cJ4BMP2Ono6hKObBX8y.png"
        alt="DripForge Logo"
        width={32}
        height={32}
        className="rounded"
      />
      <span className="text-xl font-bold">
        <span className="text-primary">Drip</span>
        <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
          Forge
        </span>
      </span>
    </>
  )

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {props.mode === "spa" ? (
          <button
            type="button"
            onClick={() => handleSpaNav("home")}
            className="flex items-center gap-2"
          >
            {logo}
          </button>
        ) : (
          <Link href="/" className="flex items-center gap-2">
            {logo}
          </Link>
        )}

        <nav className="hidden items-center gap-1 md:flex">
          {visibleNavItems.map((item) =>
            props.mode === "spa" ? (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSpaNav(item.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  isNavActive(item.id)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ) : (
              <Link
                key={item.id}
                href={shopNavHref(item.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  isNavActive(item.id)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          )}
          {supportPageVisible && (
            <SupportMissionLink
              active={supportActive}
              variant="main"
              display="desktop"
            />
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className={cn(HEADER_ICON_BTN_CLASS)}
            title={theme === "dark" ? "Light Mode" : "Dark Mode"}
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
                                  router.push(
                                    `/shop?product=${encodeURIComponent(p.id)}`
                                  )
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
                                  {p.price.toFixed(2)}
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
              className="hidden bg-primary text-primary-foreground hover:bg-primary/90 md:flex"
            >
              Jetzt Erstellen
            </Button>
          ) : (
            <Button asChild className="hidden bg-primary text-primary-foreground hover:bg-primary/90 md:flex">
              <Link href={shopNavHref("shop")}>Jetzt Erstellen</Link>
            </Button>
          )}

          {supportPageVisible && (
            <SupportMissionLink
              active={supportActive}
              variant="main"
              display="mobile"
            />
          )}

          <Link
            href={kontoHref}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
              kontoActive || (props.mode === "spa" && kontoLoggedIn)
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
            title={kontoLoggedIn ? "Mein Konto" : "Anmelden oder registrieren"}
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
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
          </Link>

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
            <Link
              href={shopCartHref()}
              className={cn(HEADER_ICON_BTN_CLASS, "relative hover:text-primary")}
              title="Warenkorb"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </Link>
          )}

          <button
            type="button"
            className={cn(HEADER_ICON_BTN_CLASS, "md:hidden")}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-border bg-background p-4 md:hidden">
          <nav className="flex flex-col gap-2">
            {visibleNavItems.map((item) =>
              props.mode === "spa" ? (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSpaNav(item.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    isNavActive(item.id)
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.id}
                  href={shopNavHref(item.id)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    isNavActive(item.id)
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            )}
            {supportPageVisible && (
              <Link
                href={SUPPORT_ROUTE}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  supportActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary/50"
                )}
              >
                <Heart className="h-5 w-5 fill-primary/20 text-primary" />
                Unsere Mission
              </Link>
            )}
            <Link
              href={kontoHref}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-primary/20 px-4 py-3 text-sm font-medium",
                kontoActive || kontoLoggedIn
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50"
              )}
            >
              <User className="h-5 w-5" />
              Mein Konto
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
