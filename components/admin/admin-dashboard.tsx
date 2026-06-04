"use client"

import { FormEvent, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ClipboardList,
  Factory,
  LayoutDashboard,
  Warehouse,
  Lock,
  LogOut,
  Moon,
  Package,
  Settings,
  Sun,
  Tag,
  Users,
} from "lucide-react"
import { AdminCustomersTab } from "@/components/admin/admin-customers-tab"
import { AdminOrdersTab } from "@/components/admin/admin-orders-tab"
import { AdminProductsTab } from "@/components/admin/admin-products-tab"
import { AdminSettingsTab } from "@/components/admin/admin-settings-tab"
import { AdminCouponsTab } from "@/components/admin/admin-coupons-tab"
import { AdminInventoryTab } from "@/components/admin/admin-inventory-tab"
import { AdminProductionTab } from "@/components/admin/admin-production-tab"
import { AdminStatsTab } from "@/components/admin/admin-stats-tab"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  isAdminSessionActive,
  setAdminSessionActive,
  verifyAdminPassword,
} from "@/lib/admin/admin-auth"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { useSiteTheme } from "@/hooks/use-site-theme"
import { cn } from "@/lib/utils"

type AdminTab =
  | "stats"
  | "production"
  | "inventory"
  | "coupons"
  | "orders"
  | "products"
  | "customers"
  | "settings"

const NAV: { id: AdminTab; label: string; icon: typeof ClipboardList }[] = [
  { id: "stats", label: "Dashboard / Statistiken", icon: LayoutDashboard },
  { id: "production", label: "Produktions-Cockpit", icon: Factory },
  { id: "inventory", label: "Lagerverwaltung", icon: Warehouse },
  { id: "coupons", label: "Gutscheine & Rabatte", icon: Tag },
  { id: "orders", label: "Bestellungen", icon: ClipboardList },
  { id: "products", label: "Produkte", icon: Package },
  { id: "customers", label: "Kundenverwaltung", icon: Users },
  { id: "settings", label: "Shop-Einstellungen", icon: Settings },
]

function AdminLoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    if (verifyAdminPassword(password)) {
      setAdminSessionActive(true)
      onSuccess()
      setPassword("")
    } else {
      setError("Falsches Passwort. Bitte erneut versuchen.")
      console.warn("Admin: Anmeldung fehlgeschlagen — falsches Passwort.")
    }

    setSubmitting(false)
  }

  return (
    <div className={cn("flex min-h-screen items-center justify-center px-4", adminUi.loginPage)}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2016.%20Mai%202026%2C%2022_19_51-CjFqSwPCG95cJ4BMP2Ono6hKObBX8y.png"
              alt="DripForge"
              width={36}
              height={36}
              className="rounded"
            />
            <span className="text-lg font-bold">
              <span className="text-orange-500">Drip</span>
              <span className={adminUi.brandText}>Forge</span>
            </span>
          </Link>
          <p className={cn("mt-3 text-sm", adminUi.muted)}>Admin-Bereich</p>
        </div>

        <form onSubmit={handleSubmit} className={cn("p-6", adminUi.loginCard)}>
          <div className={cn("mb-5 flex items-center gap-2", adminUi.loginTitle)}>
            <Lock className="h-4 w-4 text-orange-500" />
            <h1 className="text-sm font-semibold">Anmelden</h1>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password" className={adminUi.labelMuted}>
              Passwort
            </Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin-Passwort"
              className={adminUi.input}
            />
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={submitting || !password.trim()}
            className={cn("mt-5 w-full font-semibold", adminUi.primaryBtn)}
          >
            Anmelden
          </Button>
        </form>

        <p className="mt-6 text-center">
          <Link href="/" className={cn("text-xs transition-colors", adminUi.footerBtn)}>
            ← Zurueck zum Shop
          </Link>
        </p>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [tab, setTab] = useState<AdminTab>("stats")
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null)
  const { toggleTheme, isDark } = useSiteTheme()

  const openOrderFromCustomers = (orderId: string) => {
    setHighlightOrderId(orderId)
    setTab("orders")
  }

  useEffect(() => {
    setIsLoggedIn(isAdminSessionActive())
    setHydrated(true)
  }, [])

  const handleLogout = () => {
    setAdminSessionActive(false)
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
    return <AdminLoginScreen onSuccess={() => setIsLoggedIn(true)} />
  }

  return (
    <div className={cn("flex min-h-screen", adminUi.page)}>
      <aside
        className={cn(
          "sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r",
          adminUi.sidebar
        )}
      >
        <div className={cn("border-b p-6", adminUi.sidebarBorder)}>
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
                onClick={() => setTab(item.id)}
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

      <main className="min-w-0 flex-1 overflow-y-auto p-6 md:p-10">
        {tab === "stats" && <AdminStatsTab />}
        {tab === "production" && <AdminProductionTab />}
        {tab === "inventory" && <AdminInventoryTab />}
        {tab === "coupons" && <AdminCouponsTab />}
        {tab === "orders" && (
          <AdminOrdersTab
            highlightOrderId={highlightOrderId}
            onHighlightConsumed={() => setHighlightOrderId(null)}
          />
        )}
        {tab === "products" && <AdminProductsTab />}
        {tab === "customers" && (
          <AdminCustomersTab onOpenOrder={openOrderFromCustomers} />
        )}
        {tab === "settings" && <AdminSettingsTab />}
      </main>
    </div>
  )
}
