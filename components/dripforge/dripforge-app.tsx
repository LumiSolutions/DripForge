"use client"

import { useState, useEffect } from "react"
import {
  Send,
  MessageCircle,
  User,
  Bot,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ShopHeader } from "@/components/dripforge/shop-header"
import type { CartItem, Product } from "@/lib/dripforge/types"
import { normalizeShopProduct } from "@/lib/dripforge/normalize-shop-product"
import { applyQuantityDiscountsToCartItems } from "@/lib/dripforge/quantity-discount-tiers"
import type {
  ServiceVisibilitySettings,
  ShopConfiguratorSettings,
} from "@/lib/admin/types"
import {
  DEFAULT_SERVICE_VISIBILITY,
  DEFAULT_SHOP_CONFIGURATORS,
} from "@/lib/admin/types"
import {
  isViewAllowed,
  normalizeServiceVisibility,
} from "@/lib/dripforge/service-visibility"
import { normalizeShopConfigurators } from "@/lib/dripforge/shop-configurators"
import {
  normalizeManagedCatalog,
  type ManagedCatalogItem,
} from "@/lib/dripforge/managed-catalog"
import { HomePage } from "@/components/dripforge/views/home-page"
import { Page3DDruck } from "@/components/dripforge/views/page-3d-druck"
import { PageLaser } from "@/components/dripforge/views/page-laser"
import { PageShop } from "@/components/dripforge/views/page-shop"
import { PageFAQ } from "@/components/dripforge/views/page-faq"
import { hardNavigate } from "@/lib/dripforge/safe-navigate"
import { SHOP_ROUTES } from "@/lib/dripforge/shop-routes"
import { PageImpressum } from "@/components/dripforge/views/page-impressum"
import { PageAGB } from "@/components/dripforge/views/page-agb"
import { PageIndividual3D } from "@/components/dripforge/views/page-individual-3d"
import { PageIndividualLaser } from "@/components/dripforge/views/page-individual-laser"
import { PageAiConfigurator } from "@/components/dripforge/views/page-ai-configurator"
import { PageWarenkorb } from "@/components/dripforge/views/page-warenkorb"
import { PageCheckout } from "@/components/dripforge/views/page-checkout"
import { useAiPublicSettings } from "@/hooks/use-ai-public-settings"
import { useCompanySettings } from "@/components/dripforge/company-settings-provider"

export default function DripForgeApp() {
  const { company } = useCompanySettings()
  const [currentView, setCurrentView] = useState("home")
  const [selectedMaterial, setSelectedMaterial] = useState("pla")
  const [chatOpen, setChatOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(
    null
  )
  const [services, setServices] = useState<ServiceVisibilitySettings>(
    DEFAULT_SERVICE_VISIBILITY
  )
  const [shopConfigurators, setShopConfigurators] =
    useState<ShopConfiguratorSettings>(DEFAULT_SHOP_CONFIGURATORS)
  const [managedCatalog, setManagedCatalog] = useState<ManagedCatalogItem[]>(() =>
    normalizeManagedCatalog(null, DEFAULT_SERVICE_VISIBILITY, DEFAULT_SHOP_CONFIGURATORS)
  )
  const [servicesLoaded, setServicesLoaded] = useState(false)
  const aiPublic = useAiPublicSettings()
  const [pendingProductId, setPendingProductId] = useState<string | null>(null)

  useEffect(() => {
    if (currentView !== "shop") {
      setSelectedProduct(null)
    }
  }, [currentView])

  useEffect(() => {
    void fetch("/api/settings/services")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          const normalizedServices = normalizeServiceVisibility(data)
          const normalizedShop = normalizeShopConfigurators(
            data.shopConfigurators,
            normalizedServices
          )
          setServices(normalizedServices)
          setShopConfigurators(normalizedShop)
          setManagedCatalog(
            normalizeManagedCatalog(
              data.managedCatalog,
              normalizedServices,
              normalizedShop
            )
          )
        }
      })
      .catch(() => {
        console.warn("Navigation: Service-Sichtbarkeit konnte nicht geladen werden.")
      })
      .finally(() => {
        setServicesLoaded(true)
      })
  }, [])

  useEffect(() => {
    if (!isViewAllowed(currentView, services, { aiEnabled: aiPublic.enabled })) {
      setCurrentView("home")
    }
  }, [currentView, services, aiPublic.enabled])

  // Kontakt ist in «Über uns» integriert – SPA-View sofort weiterleiten.
  useEffect(() => {
    if (currentView === "kontakt") {
      hardNavigate(SHOP_ROUTES.kontakt)
    }
  }, [currentView])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const view = params.get("view")
    const productId = params.get("product")?.trim()
    if (view && isViewAllowed(view, services, { aiEnabled: aiPublic.enabled })) {
      setCurrentView(view)
    }
    if (productId) {
      setPendingProductId(productId)
    }
    if (params.get("order_success") === "1") {
      setOrderSuccessMessage(
        "Vielen Dank! Deine Zahlung war erfolgreich. Die Bestellung wird verarbeitet — KI-Credits werden nach Bestätigung gutgeschrieben."
      )
      setCart([])
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [services, aiPublic.enabled])

  useEffect(() => {
    if (currentView !== "shop" || !pendingProductId) return
    const productId = pendingProductId
    setPendingProductId(null)
    void fetch(`/api/products/${encodeURIComponent(productId)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.product) {
          setSelectedProduct(normalizeShopProduct(data.product as Product))
        }
      })
      .catch(() => {
        console.warn("Shop: Deep-Link-Produkt konnte nicht geladen werden.")
      })
  }, [currentView, pendingProductId])

  const addToCart = (item: CartItem) => {
    setCart((prev) =>
      applyQuantityDiscountsToCartItems([...prev, item])
    )
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
        content: `Vielen Dank für Ihre Nachricht! Unser Team wird sich in Kürze bei Ihnen melden. Für dringende Anfragen erreichen Sie uns unter ${company.kontaktEmail}`
      }])
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ShopHeader
        mode="spa"
        currentView={currentView}
        onNavigate={setCurrentView}
        cartCount={cart.length}
        onOpenShop={() => setCurrentView("shop")}
      />

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
          <PageLaser
            setCurrentView={setCurrentView}
            services={services}
            managedCatalog={managedCatalog}
          />
        )}
        {currentView === "shop" && (
          <PageShop
            setCurrentView={setCurrentView}
            selectedProduct={selectedProduct}
            setSelectedProduct={setSelectedProduct}
            addToCart={addToCart}
            services={services}
            shopConfigurators={shopConfigurators}
            servicesLoaded={servicesLoaded}
          />
        )}
        {currentView === "faq" && <PageFAQ setCurrentView={setCurrentView} />}
        {currentView === "impressum" && <PageImpressum setCurrentView={setCurrentView} />}
        {currentView === "agb" && <PageAGB setCurrentView={setCurrentView} />}
        {currentView === "individual-3d" && <PageIndividual3D />}
        {currentView === "individual-laser" && <PageIndividualLaser setCurrentView={setCurrentView} addToCart={addToCart} />}
        {currentView === "ai-konfigurator" && aiPublic.enabled && (
          <PageAiConfigurator setCurrentView={setCurrentView} />
        )}
        {currentView === "warenkorb" && <PageWarenkorb setCurrentView={setCurrentView} cart={cart} setCart={setCart} />}
        {currentView === "checkout" && (
          <PageCheckout
            setCurrentView={setCurrentView}
            cart={cart}
            onOrderComplete={() => {
              setCart([])
            }}
          />
        )}
      </main>

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
              onClick={() => hardNavigate(SHOP_ROUTES.kontakt)}
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
