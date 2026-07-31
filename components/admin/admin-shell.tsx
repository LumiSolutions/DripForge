"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, LogOut, Menu, Moon, Sun, X } from "lucide-react"
import { StaffAuthFlow } from "@/components/admin/staff-auth-flow"
import {
  ADMIN_NAV_SECTIONS,
  findAdminNavLabel,
  isAdminNavActive,
  LEGACY_ADMIN_TAB_REDIRECTS,
  matchAdminRoute,
  type AdminRouteId,
} from "@/lib/admin/admin-nav"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { useSiteTheme } from "@/hooks/use-site-theme"
import { cn } from "@/lib/utils"

function AdminLegacyTabRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const tab = searchParams.get("tab")?.trim()
    if (!tab) return
    const target = LEGACY_ADMIN_TAB_REDIRECTS[tab]
    if (!target) return

    const next = new URLSearchParams(searchParams.toString())
    next.delete("tab")
    const [path, embeddedQuery] = target.split("?")
    if (embeddedQuery) {
      const embedded = new URLSearchParams(embeddedQuery)
      embedded.forEach((value, key) => next.set(key, value))
    }
    const qs = next.toString()
    router.replace(`${adminPortalPath(path ?? "")}${qs ? `?${qs}` : ""}`)
  }, [router, searchParams])

  return null
}

function AdminShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const { toggleTheme, isDark } = useSiteTheme()

  const activeRoute = matchAdminRoute(pathname)
  const currentLabel = findAdminNavLabel(pathname)

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

  useEffect(() => {
    if (!mobileNavOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileNavOpen])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const autoExpanded = useMemo(() => {
    const next: Record<string, boolean> = {}
    for (const section of ADMIN_NAV_SECTIONS) {
      for (const item of section.items) {
        if (!item.children?.length) continue
        const childActive = item.children.some((child) =>
          isAdminNavActive(pathname, child.href, { exact: true })
        )
        if (childActive || activeRoute === item.id) {
          next[item.id] = true
        }
      }
    }
    return next
  }, [pathname, activeRoute])

  const isGroupOpen = (id: AdminRouteId) =>
    expandedGroups[id] ?? autoExpanded[id] ?? false

  const toggleGroup = (id: AdminRouteId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? autoExpanded[id] ?? false),
    }))
  }

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
      <Suspense fallback={null}>
        <AdminLegacyTabRedirect />
      </Suspense>

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
            <p className={cn("truncate text-[10px]", adminUi.muted)}>{currentLabel}</p>
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
          <Link href={adminPortalPath("/dashboard")} className="flex items-center gap-2">
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

        <nav className="flex-1 overflow-y-auto p-3">
          {ADMIN_NAV_SECTIONS.map((section, sectionIndex) => (
            <div key={section.title}>
              <p
                className={cn(
                  "px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                  sectionIndex > 0 ? "pt-3" : "pt-0",
                  adminUi.muted
                )}
              >
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const hasChildren = Boolean(item.children?.length)
                  const childActive = item.children?.some((child) =>
                    isAdminNavActive(pathname, child.href, { exact: true })
                  )
                  const selfActive =
                    isAdminNavActive(pathname, item.href, {
                      exact: item.id === "produkte",
                    }) && !childActive
                  const groupActive = Boolean(childActive) || selfActive
                  const open = hasChildren ? isGroupOpen(item.id) : false

                  if (!hasChildren) {
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={cn(
                          "flex w-full min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                          isAdminNavActive(pathname, item.href, { exact: true })
                            ? adminUi.navActive
                            : adminUi.navInactive
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 truncate leading-snug">
                          {item.label}
                        </span>
                      </Link>
                    )
                  }

                  return (
                    <div key={item.id} className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.id)}
                        className={cn(
                          "flex w-full min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                          groupActive ? adminUi.navActive : adminUi.navInactive
                        )}
                        aria-expanded={open}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-left leading-snug">
                          {item.label}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform",
                            open && "rotate-180"
                          )}
                        />
                      </button>
                      {open && (
                        <div className="ml-3 min-w-0 space-y-0.5 border-l border-border/60 pl-2">
                          {item.children!.map((child) => (
                            <Link
                              key={child.id}
                              href={child.href}
                              className={cn(
                                "flex w-full min-w-0 items-center rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                                isAdminNavActive(pathname, child.href, {
                                  exact: true,
                                })
                                  ? adminUi.navActive
                                  : adminUi.navInactive
                              )}
                            >
                              <span className="min-w-0 truncate">{child.label}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
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
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {isDark ? "Light-Mode" : "Dark-Mode"}
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
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
        {children}
      </main>
    </div>
  )
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Wird geladen…
        </div>
      }
    >
      <AdminShellFrame>{children}</AdminShellFrame>
    </Suspense>
  )
}
