"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Home,
  Printer,
  Zap,
  ShoppingBag,
  MessageSquare,
  Menu,
  X,
  Mail,
  MapPin,
  Send,
  Sparkles,
  ArrowRight,
  MessageCircle,
  User,
  Bot,
  Box,
  Search,
  Moon,
  Sun,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { CartItem, Product } from "@/lib/dripforge/types"
import type {
  CompanySettings,
  ServiceVisibilitySettings,
} from "@/lib/admin/types"
import { DEFAULT_COMPANY_SETTINGS, DEFAULT_SERVICE_VISIBILITY } from "@/lib/admin/types"
import { products } from "@/lib/dripforge/data"
import {
  filterNavItems,
  isShopNavVisible,
  isViewAllowed,
  normalizeServiceVisibility,
} from "@/lib/dripforge/service-visibility"
import { HomePage } from "@/components/dripforge/views/home-page"
import { Page3DDruck } from "@/components/dripforge/views/page-3d-druck"
import { PageLaser } from "@/components/dripforge/views/page-laser"
import { PageShop } from "@/components/dripforge/views/page-shop"
import { PageKontakt } from "@/components/dripforge/views/page-kontakt"
import { PageFAQ } from "@/components/dripforge/views/page-faq"
import { PageImpressum } from "@/components/dripforge/views/page-impressum"
import { PageAGB } from "@/components/dripforge/views/page-agb"
import { PageIndividual3D } from "@/components/dripforge/views/page-individual-3d"
import { PageIndividualLaser } from "@/components/dripforge/views/page-individual-laser"
import { PageWarenkorb } from "@/components/dripforge/views/page-warenkorb"
import { PageCheckout } from "@/components/dripforge/views/page-checkout"

export default function DripForgeApp() {
  const [currentView, setCurrentView] = useState("home")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState("pla")
  const [shopFilter, setShopFilter] = useState("all")
  const [chatOpen, setChatOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [companyFooter, setCompanyFooter] = useState<CompanySettings>(
    DEFAULT_COMPANY_SETTINGS
  )
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(
    null
  )
  const [services, setServices] = useState<ServiceVisibilitySettings>(
    DEFAULT_SERVICE_VISIBILITY
  )
  const [kontoLoggedIn, setKontoLoggedIn] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const htmlRef = useRef<HTMLElement>(null)

  // Initialize theme from localStorage and sync to DOM
  useEffect(() => {
    htmlRef.current = document.documentElement
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light")
    setTheme(initialTheme)
    htmlRef.current.classList.toggle("dark", initialTheme === "dark")
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => {
      const newTheme = prev === "dark" ? "light" : "dark"
      localStorage.setItem("theme", newTheme)
      return newTheme
    })
  }

  useEffect(() => {
    if (currentView !== "shop") {
      setSelectedProduct(null)
    }
  }, [currentView])

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
  }, [])

  const kontoHref = kontoLoggedIn ? "/konto" : "/konto/login"

  const visibleNavItems = filterNavItems(services)

  useEffect(() => {
    if (!isViewAllowed(currentView, services)) {
      setCurrentView("home")
    }
  }, [currentView, services])

  useEffect(() => {
    void fetch("/api/settings/company")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.firmenname) {
          setCompanyFooter({ ...DEFAULT_COMPANY_SETTINGS, ...data })
        }
      })
      .catch(() => {
        console.warn("Footer: Firmendaten konnten nicht geladen werden.")
      })
  }, [])

  // Close search on outside click
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

  const searchResults = searchQuery.trim().length > 0
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []
  
  const addToCart = (item: CartItem) => {
    setCart(prev => [...prev, item])
  }
  
  const [chatMessages, setChatMessages] = useState([
    { id: "1", role: "assistant", content: "Willkommen bei DripForge! Wie kann ich Ihnen heute helfen? Ich kann Fragen zu unseren 3D-Druck- und Lasergravur-Services beantworten." }
  ])
  const [chatInput, setChatInput] = useState("")

  const handleSendMessage = () => {
    if (!chatInput.trim()) return
    const newMessage = { id: Date.now().toString(), role: "user" as const, content: chatInput }
    setChatMessages([...chatMessages, newMessage])
    setChatInput("")
    // Simulate response
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: "Vielen Dank für Ihre Nachricht! Unser Team wird sich in Kürze bei Ihnen melden. Für dringende Anfragen erreichen Sie uns unter drip-forge@outlook.com"
      }])
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <button onClick={() => setCurrentView("home")} className="flex items-center gap-2">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2016.%20Mai%202026%2C%2022_19_51-CjFqSwPCG95cJ4BMP2Ono6hKObBX8y.png"
              alt="DripForge Logo"
              width={32}
              height={32}
              className="rounded"
            />
            <span className="text-xl font-bold">
              <span className="text-primary">Drip</span>
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Forge</span>
            </span>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {visibleNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  currentView === item.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="text-muted-foreground transition-colors hover:text-foreground"
              title={theme === "dark" ? "Light Mode" : "Dark Mode"}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Search */}
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
                      if (e.key === "Escape") { setSearchOpen(false); setSearchQuery("") }
                    }}
                  />
                  <button onClick={() => { setSearchOpen(false); setSearchQuery("") }}>
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  title="Suchen"
                >
                  <Search className="h-5 w-5" />
                </button>
              )}

              {/* Dropdown results */}
              {searchOpen && searchQuery.trim().length > 0 && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-background shadow-xl">
                  {searchResults.length > 0 ? (
                    <>
                      <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                        {searchResults.length} Ergebnis{searchResults.length !== 1 ? "se" : ""}
                      </p>
                      <ul>
                        {searchResults.map((p) => (
                          <li key={p.id}>
                            <button
                              onClick={() => {
                                setCurrentView("shop")
                                setShopFilter(p.type)
                                setSelectedProduct(p)
                                setSearchOpen(false)
                                setSearchQuery("")
                              }}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60"
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                {p.type === "3d"
                                  ? <Box className="h-4 w-4 text-primary" />
                                  : <Zap className="h-4 w-4 text-cyan-400" />}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{p.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{p.type === "3d" ? "3D-Druck" : "Lasergravur"} · CHF {p.price.toFixed(2)}</p>
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

            <Button 
              onClick={() => setCurrentView("shop")}
              className="hidden bg-primary text-primary-foreground hover:bg-primary/90 md:flex"
            >
              Jetzt Erstellen
            </Button>

            <Link
              href={kontoHref}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                kontoLoggedIn
                  ? "text-primary hover:bg-primary/10"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
              title={kontoLoggedIn ? "Mein Konto" : "Anmelden oder registrieren"}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                  kontoLoggedIn
                    ? "border-primary/40 bg-primary/15"
                    : "border-border/80 bg-secondary/50"
                )}
              >
                <User
                  className={cn(
                    "h-4 w-4",
                    kontoLoggedIn ? "text-primary" : "text-muted-foreground"
                  )}
                />
              </span>
              <span className="hidden lg:inline">Mein Konto</span>
            </Link>

            <button
              onClick={() => setCurrentView("warenkorb")}
              className="relative text-muted-foreground hover:text-primary"
              title="Warenkorb"
            >
              <ShoppingBag className="h-6 w-6" />
              {cart.length > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {cart.length}
                </span>
              )}
            </button>
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-border bg-background p-4 md:hidden">
            <nav className="flex flex-col gap-2">
              {visibleNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id)
                    setMobileMenuOpen(false)
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                    currentView === item.id
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </button>
              ))}
              <Link
                href={kontoHref}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-primary/20 px-4 py-3 text-sm font-medium",
                  kontoLoggedIn
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

      {/* Main Content */}
      <main>
        {orderSuccessMessage && (
          <div className="mx-auto max-w-4xl px-4 pt-4">
            <div
              role="status"
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
            >
              <p>{orderSuccessMessage}</p>
              <button
                type="button"
                onClick={() => setOrderSuccessMessage(null)}
                className="mt-2 text-xs font-medium underline underline-offset-2"
              >
                Schliessen
              </button>
            </div>
          </div>
        )}
        {currentView === "home" && (
          <HomePage setCurrentView={setCurrentView} services={services} />
        )}
        {currentView === "3d-druck" && (
          <Page3DDruck 
            selectedMaterial={selectedMaterial} 
            setSelectedMaterial={setSelectedMaterial}
            setCurrentView={setCurrentView}
          />
        )}
        {currentView === "laser" && (
          <PageLaser setCurrentView={setCurrentView} services={services} />
        )}
        {currentView === "shop" && (
          <PageShop
            shopFilter={shopFilter}
            setShopFilter={setShopFilter}
            setCurrentView={setCurrentView}
            selectedProduct={selectedProduct}
            setSelectedProduct={setSelectedProduct}
            addToCart={addToCart}
            services={services}
          />
        )}
        {currentView === "kontakt" && <PageKontakt setCurrentView={setCurrentView} />}
        {currentView === "faq" && <PageFAQ setCurrentView={setCurrentView} />}
        {currentView === "impressum" && <PageImpressum setCurrentView={setCurrentView} />}
        {currentView === "agb" && <PageAGB setCurrentView={setCurrentView} />}
        {currentView === "individual-3d" && <PageIndividual3D setCurrentView={setCurrentView} addToCart={addToCart} />}
        {currentView === "individual-laser" && <PageIndividualLaser setCurrentView={setCurrentView} addToCart={addToCart} />}
        {currentView === "warenkorb" && <PageWarenkorb setCurrentView={setCurrentView} cart={cart} setCart={setCart} />}
        {currentView === "checkout" && (
          <PageCheckout
            setCurrentView={setCurrentView}
            cart={cart}
            onOrderComplete={() => {
              setCart([])
              setOrderSuccessMessage(
                "Vielen Dank! Deine Bestellung wurde erfolgreich übermittelt. Bei «Kauf auf Rechnung» erhältst du die Rechnung per E-Mail, sobald SMTP im Portal konfiguriert ist."
              )
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2016.%20Mai%202026%2C%2022_19_51-CjFqSwPCG95cJ4BMP2Ono6hKObBX8y.png"
                  alt="DripForge"
                  width={28}
                  height={28}
                  className="rounded"
                />
                <span className="font-bold">
                  <span className="text-primary">Drip</span>
                  <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Forge</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Verwandeln Sie Ihre Ideen in Realität mit präzisem 3D-Druck und Lasergravur-Services.
              </p>
              <div className="mt-4 flex gap-2">
                <Printer className="h-5 w-5 text-muted-foreground" />
                <Zap className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-foreground">Services</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {services.druck3d && (
                  <li>
                    <button
                      onClick={() => setCurrentView("3d-druck")}
                      className="hover:text-primary"
                    >
                      3D-Druck
                    </button>
                  </li>
                )}
                {(services.lasergravur ||
                  services.laserschnitt ||
                  services.markierungAetzung) && (
                  <li>
                    <button
                      onClick={() => setCurrentView("laser")}
                      className="hover:text-primary"
                    >
                      Lasergravur
                    </button>
                  </li>
                )}
                {isShopNavVisible(services) && (
                  <li>
                    <button
                      onClick={() => setCurrentView("shop")}
                      className="hover:text-primary"
                    >
                      Shop
                    </button>
                  </li>
                )}
                {services.druck3d && (
                  <li>
                    <button
                      onClick={() => setCurrentView("individual-3d")}
                      className="hover:text-primary"
                    >
                      Individueller 3D-Druck
                    </button>
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-foreground">Unternehmen</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => setCurrentView("kontakt")} className="hover:text-primary">Kontakt</button></li>
                <li><button onClick={() => setCurrentView("faq")} className="hover:text-primary">FAQ</button></li>
                <li><button onClick={() => setCurrentView("impressum")} className="hover:text-primary">Impressum</button></li>
                <li><button onClick={() => setCurrentView("agb")} className="hover:text-primary">AGB</button></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-foreground">Kontakt</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  drip-forge@outlook.com
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  <span className="whitespace-pre-line">
                    {companyFooter.firmenname}
                    {companyFooter.firmenAdresse
                      ? `\n${companyFooter.firmenAdresse}`
                      : ""}
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
            <p className="text-sm text-muted-foreground">
              © 2026 {companyFooter.firmenname || "DripForge"}. Alle Rechte vorbehalten.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="/datenschutz" className="hover:text-primary">
                Datenschutz
              </a>
              <a href="/agb" className="hover:text-primary">
                AGB
              </a>
              <a href="/admin" className="hover:text-primary">
                Admin-Login
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Chat Button */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Chat Window */}
      {chatOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-secondary/50 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">DripForge Assistent</p>
                <p className="text-xs text-muted-foreground">Online</p>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="h-64 overflow-y-auto p-4">
            <div className="space-y-4">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}>
                  <div className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    msg.role === "assistant" ? "bg-primary" : "bg-secondary"
                  )}>
                    {msg.role === "assistant" ? (
                      <Bot className="h-3 w-3 text-primary-foreground" />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                  </div>
                  <div className={cn(
                    "rounded-2xl px-3 py-2 text-sm",
                    msg.role === "assistant" ? "bg-secondary" : "bg-primary text-primary-foreground"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Nachricht eingeben..."
                className="flex-1"
              />
              <Button size="icon" onClick={handleSendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <button 
              onClick={() => setCurrentView("kontakt")}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Team kontaktieren
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
