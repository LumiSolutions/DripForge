"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Calculator,
  ClipboardList,
  Factory,
  FileText,
  LayoutDashboard,
  Warehouse,
  LogOut,
  Menu,
  Moon,
  Package,
  Settings,
  Sun,
  Tag,
  Sparkles,
  Type,
  Users,
  X,
} from "lucide-react"
import { AdminInvoiceTemplateTab } from "@/components/admin/admin-invoice-template-tab"
import { AdminAiSettingsTab } from "@/components/admin/admin-ai-settings-tab"
import { AdminCustomersTab } from "@/components/admin/admin-customers-tab"
import { AdminOrdersTab } from "@/components/admin/admin-orders-tab"
import { AdminProductsTab } from "@/components/admin/admin-products-tab"
import { AdminSettingsTab } from "@/components/admin/admin-settings-tab"
import { AdminSiteTextsTab } from "@/components/admin/admin-site-texts-tab"
import { AdminCouponsTab } from "@/components/admin/admin-coupons-tab"
import { AdminMaterialsTab } from "@/components/admin/admin-materials-tab"
import { AdminMaterialStatsSection } from "@/components/admin/admin-material-stats-section"
import { AdminProductionTab } from "@/components/admin/admin-production-tab"
import { AdminPrintCalculatorTab } from "@/components/admin/admin-print-calculator-tab"
import { AdminStatsTab } from "@/components/admin/admin-stats-tab"
import { StaffAuthFlow } from "@/components/admin/staff-auth-flow"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { useSiteTheme } from "@/hooks/use-site-theme"
import type { MaterialCategory } from "@/lib/admin/material-types"
import { cn } from "@/lib/utils"

type AdminTab =
  | "stats"
  | "production"
  | "inventory"
  | "coupons"
  | "orders"
  | "invoice-template"
  | "products"
  | "customers"
  | "settings"
  | "site-texts"
  | "print-calculator"
  | "ai-settings"

type InventorySubTab = MaterialCategory | "material-types"

const INVENTORY_SUB: { id: InventorySubTab; label: string }[] = [
  { id: "filament", label: "Filament-Lager" },
  { id: "material-types", label: "Material-Arten" },
  { id: "lasermaterial", label: "Lasermaterial" },
]

const NAV: { id: AdminTab; label: string; icon: typeof ClipboardList }[] = [
  { id: "stats", label: "Dashboard / Statistiken", icon: LayoutDashboard },
  { id: "production", label: "Produktions-Cockpit", icon: Factory },
  { id: "inventory", label: "Lagerverwaltung", icon: Warehouse },
  { id: "coupons", label: "Gutscheine & Rabatte", icon: Tag },
  { id: "orders", label: "Bestellungen", icon: ClipboardList },
  { id: "invoice-template", label: "Dokumenten-Vorlagen", icon: FileText },
  { id: "products", label: "Produkte", icon: Package },
  { id: "customers", label: "Kundenverwaltung", icon: Users },
  { id: "settings", label: "Shop-Einstellungen", icon: Settings },
  { id: "site-texts", label: "Texte & Inhalte", icon: Type },
  { id: "ai-settings", label: "KI-Modell-Konfiguration", icon: Sparkles },
  { id: "print-calculator", label: "Druck-Kalkulator", icon: Calculator },
]

export function AdminDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [tab, setTab] = useState<AdminTab>("stats")
  const [inventorySub, setInventorySub] = useState<InventorySubTab>("filament")
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { toggleTheme, isDark } = useSiteTheme()

  const openOrderFromCustomers = (orderId: string) => {
    setHighlightOrderId(orderId)
    setTab("orders")
    setMobileNavOpen(false)
  }

  const selectTab = (next: AdminTab) => {
    setTab(next)
    setMobileNavOpen(false)
  }

  useEffect(() => {
    if (!mobileNavOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileNavOpen])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/auth/me", { credentials: "include" })
        setIsLoggedIn(res.ok)
      } catch {
        setIsLoggedIn(false)
      } finally {
        setHydrated(true)
      }
    })()
  }, [])

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        credentials: "include",
      })
    } catch {
      /* ignore */
    }
    setIsLoggedIn(false)
  }

  if (!hydrated) {
    return (
      <div className={cn("flex min-h-screen items-center justify-center", adminUi.loader)}>
        Wird geladen…
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className={cn("flex min-h-screen items-center justify-center px-4", adminUi.loginPage)}>
        <StaffAuthFlow
          role="admin"
          intent="admin"
          title="Anmelden"
          subtitle="Admin-Bereich"
          passwordPlaceholder="Admin-Passwort"
          onSuccess={() => setIsLoggedIn(true)}
        />
      </div>
    )
  }

  return (
    <div className={cn("flex min-h-screen flex-col lg:flex-row", adminUi.page)}>
      <header
        className={cn(
          "sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:hidden",
          adminUi.sidebar,
          adminUi.sidebarBorder
        )}
      >
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
            adminUi.footerBtn
          )}
          aria-label="Menü öffnen"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2016.%20Mai%202026%2C%2022_19_51-CjFqSwPCG95cJ4BMP2Ono6hKObBX8y.png"
            alt="DripForge"
            width={24}
            height={24}
            className="rounded"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">
              <span className="text-orange-500">Drip</span>
              <span className={adminUi.brandText}>Forge</span>
              <span className={cn("ml-1.5 font-normal", adminUi.muted)}>Admin</span>
            </p>
            <p className={cn("truncate text-[10px]", adminUi.muted)}>
              {NAV.find((item) => item.id === tab)?.label}
            </p>
          </div>
        </Link>
      </header>

      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Menü schliessen"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r transition-transform duration-300 ease-in-out",
          "lg:sticky lg:top-0 lg:z-auto lg:shrink-0 lg:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          adminUi.sidebar
        )}
      >
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className={cn(
            "absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg lg:hidden",
            adminUi.footerBtn
          )}
          aria-label="Menü schliessen"
        >
          <X className="h-5 w-5" />
        </button>

        <div className={cn("border-b p-6 pr-14 lg:pr-6", adminUi.sidebarBorder)}>
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2016.%20Mai%202026%2C%2022_19_51-CjFqSwPCG95cJ4BMP2Ono6hKObBX8y.png"
              alt="DripForge"
              width={28}
              height={28}
              className="rounded"
            />
            <div>
              <p className="text-sm font-bold">
                <span className="text-orange-500">Drip</span>
                <span className={adminUi.brandText}>Forge</span>
              </p>
              <p className={cn("text-[10px] uppercase tracking-wider", adminUi.muted)}>
                Admin
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  active ? adminUi.navActive : adminUi.navInactive
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className={cn("space-y-1 border-t p-4", adminUi.sidebarBorder)}>
          <button
            type="button"
            onClick={toggleTheme}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors",
              adminUi.footerBtn
            )}
            aria-label={isDark ? "Light-Mode aktivieren" : "Dark-Mode aktivieren"}
          >
            {isDark ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
            {isDark ? "Light-Mode" : "Dark-Mode"}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors",
              adminUi.footerBtn
            )}
          >
            <LogOut className="h-3.5 w-3.5" />
            Abmelden
          </button>
          <Link
            href="/"
            className={cn(
              "block rounded-lg px-3 py-2 text-xs transition-colors",
              adminUi.footerBtn
            )}
          >
            ← Zurueck zum Shop
          </Link>
        </div>
      </aside>

      <main className="min-w-0 w-full flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10">
        {tab === "stats" && <AdminStatsTab />}
        {tab === "production" && <AdminProductionTab />}
        {tab === "inventory" && (
          <div className="space-y-6">
            <div className={cn("flex flex-wrap gap-2 rounded-xl border p-2", adminUi.section)}>
              {INVENTORY_SUB.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setInventorySub(sub.id)}
                  className={cn(
                    "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    inventorySub === sub.id ? adminUi.navActive : adminUi.navInactive
                  )}
                >
                  {sub.label}
                </button>
              ))}
            </div>
            {inventorySub === "material-types" ? (
              <AdminMaterialStatsSection />
            ) : (
              <AdminMaterialsTab category={inventorySub} />
            )}
          </div>
        )}
        {tab === "coupons" && <AdminCouponsTab />}
        {tab === "orders" && (
          <AdminOrdersTab
            highlightOrderId={highlightOrderId}
            onHighlightConsumed={() => setHighlightOrderId(null)}
          />
        )}
        {tab === "invoice-template" && <AdminInvoiceTemplateTab />}
        {tab === "products" && <AdminProductsTab />}
        {tab === "customers" && (
          <AdminCustomersTab onOpenOrder={openOrderFromCustomers} />
        )}
        {tab === "settings" && <AdminSettingsTab />}
        {tab === "site-texts" && <AdminSiteTextsTab />}
        {tab === "ai-settings" && <AdminAiSettingsTab />}
        {tab === "print-calculator" && <AdminPrintCalculatorTab />}
      </main>
    </div>
  )
}
