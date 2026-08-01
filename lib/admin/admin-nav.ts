import type { LucideIcon } from "lucide-react"
import {
  Calculator,
  Clock,
  Droplets,
  Factory,
  FileText,
  Files,
  FlaskConical,
  Landmark,
  LayoutDashboard,
  Mail,
  Package,
  Settings,
  Settings2,
  Sparkles,
  Tag,
  Users,
  HeartHandshake,
  Inbox,
  Layers,
  Wrench,
} from "lucide-react"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"

/** Eindeutige Admin-Routen-IDs (entsprechen URL-Segmenten). */
export type AdminRouteId =
  | "dashboard"
  | "produktionscockpit"
  | "anfragen"
  | "kundenverwaltung"
  | "belege"
  | "produkte"
  | "produkte-lager"
  | "buchhaltung"
  | "gutscheine"
  | "buchhaltungseinstellungen"
  | "countdown"
  | "erstbesucher"
  | "treuepunkte"
  | "druckkalkulator"
  | "laserkonfigurator"
  | "ki-modell"
  | "shop-einstellungen"
  | "support-kampagne"
  | "dienstleistungen"
  | "website-staging"
  | "edit"
  | "edit-preview"
  | "test"
  | "test-preview"
  | "dokumenten-vorlagen"
  | "email-vorlagen"

export type AdminNavChild = {
  id: AdminRouteId
  label: string
  href: string
}

export type AdminNavItem = {
  id: AdminRouteId
  label: string
  href: string
  icon: LucideIcon
  children?: AdminNavChild[]
}

export type AdminNavSection = {
  title: string
  items: AdminNavItem[]
}

/** Relativer Pfad unter /dripforgehq (ohne führenden Slash am Ende). */
export const ADMIN_ROUTE_PATHS: Record<AdminRouteId, string> = {
  dashboard: "/dashboard",
  produktionscockpit: "/produktionscockpit",
  anfragen: "/anfragen",
  kundenverwaltung: "/kundenverwaltung",
  belege: "/belege",
  produkte: "/produkte",
  "produkte-lager": "/produkte/lager",
  buchhaltung: "/buchhaltung",
  gutscheine: "/gutscheine",
  buchhaltungseinstellungen: "/buchhaltungseinstellungen",
  countdown: "/countdown",
  erstbesucher: "/erstbesucher",
  treuepunkte: "/treuepunkte",
  druckkalkulator: "/druckkalkulator",
  laserkonfigurator: "/laserkonfigurator",
  "ki-modell": "/ki-modell",
  "shop-einstellungen": "/shop-einstellungen",
  "support-kampagne": "/support-kampagne",
  dienstleistungen: "/dienstleistungen",
  "website-staging": "/website-staging",
  edit: "/edit",
  "edit-preview": "/edit/preview",
  test: "/test",
  "test-preview": "/test/preview",
  "dokumenten-vorlagen": "/dokumenten-vorlagen",
  "email-vorlagen": "/email-vorlagen",
}

export function adminRouteHref(id: AdminRouteId): string {
  return adminPortalPath(ADMIN_ROUTE_PATHS[id])
}

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    title: "ÜBERSICHT",
    items: [
      {
        id: "dashboard",
        label: "Dashboard / Statistiken",
        href: adminRouteHref("dashboard"),
        icon: LayoutDashboard,
      },
      {
        id: "produktionscockpit",
        label: "Produktionscockpit",
        href: adminRouteHref("produktionscockpit"),
        icon: Factory,
      },
    ],
  },
  {
    title: "TAGESGESCHÄFT",
    items: [
      {
        id: "anfragen",
        label: "Kontaktanfragen",
        href: adminRouteHref("anfragen"),
        icon: Inbox,
      },
      {
        id: "kundenverwaltung",
        label: "Kundenverwaltung",
        href: adminRouteHref("kundenverwaltung"),
        icon: Users,
      },
      {
        id: "belege",
        label: "Belege",
        href: adminRouteHref("belege"),
        icon: Files,
      },
      {
        id: "produkte",
        label: "Produkte",
        href: adminRouteHref("produkte"),
        icon: Package,
        children: [
          {
            id: "produkte",
            label: "Produkte",
            href: adminRouteHref("produkte"),
          },
          {
            id: "produkte-lager",
            label: "Lagerverwaltung",
            href: adminRouteHref("produkte-lager"),
          },
        ],
      },
    ],
  },
  {
    title: "BUCHHALTUNG",
    items: [
      {
        id: "buchhaltung",
        label: "Buchhaltung",
        href: adminRouteHref("buchhaltung"),
        icon: Landmark,
      },
      {
        id: "gutscheine",
        label: "Gutscheine & Rabatte",
        href: adminRouteHref("gutscheine"),
        icon: Tag,
      },
      {
        id: "buchhaltungseinstellungen",
        label: "Finanz-Setup",
        href: adminRouteHref("buchhaltungseinstellungen"),
        icon: Settings2,
      },
    ],
  },
  {
    title: "TOOLS",
    items: [
      {
        id: "countdown",
        label: "Countdown",
        href: adminRouteHref("countdown"),
        icon: Clock,
      },
      {
        id: "erstbesucher",
        label: "Erstbesucher Onboarding",
        href: adminRouteHref("erstbesucher"),
        icon: Droplets,
      },
      {
        id: "treuepunkte",
        label: "Treuepunkte",
        href: adminRouteHref("treuepunkte"),
        icon: HeartHandshake,
      },
      {
        id: "druckkalkulator",
        label: "Druckkalkulator",
        href: adminRouteHref("druckkalkulator"),
        icon: Calculator,
      },
      {
        id: "laserkonfigurator",
        label: "Laserkonfigurator / Kundeneinsendungen",
        href: adminRouteHref("laserkonfigurator"),
        icon: Wrench,
      },
      {
        id: "ki-modell",
        label: "KI-Modell-Konfigurator",
        href: adminRouteHref("ki-modell"),
        icon: Sparkles,
      },
    ],
  },
  {
    title: "EINSTELLUNGEN",
    items: [
      {
        id: "shop-einstellungen",
        label: "Shop-Einstellungen",
        href: adminRouteHref("shop-einstellungen"),
        icon: Settings,
      },
      {
        id: "support-kampagne",
        label: "Support-Kampagne",
        href: adminRouteHref("support-kampagne"),
        icon: HeartHandshake,
      },
      {
        id: "dienstleistungen",
        label: "Dienstleistungen auf Website",
        href: adminRouteHref("dienstleistungen"),
        icon: Layers,
      },
      {
        id: "edit",
        label: "Website bearbeiten",
        href: adminRouteHref("edit"),
        icon: FlaskConical,
        children: [
          {
            id: "edit",
            label: "Website bearbeiten",
            href: adminRouteHref("edit"),
          },
          {
            id: "edit-preview",
            label: "In-Context Editor",
            href: adminRouteHref("edit-preview"),
          },
          {
            id: "test",
            label: "Test-Umgebung",
            href: adminRouteHref("test"),
          },
          {
            id: "test-preview",
            label: "Preview",
            href: adminRouteHref("test-preview"),
          },
        ],
      },
      {
        id: "dokumenten-vorlagen",
        label: "Dokumenten-Vorlagen",
        href: adminRouteHref("dokumenten-vorlagen"),
        icon: FileText,
      },
      {
        id: "email-vorlagen",
        label: "E-Mail-Vorlagen",
        href: adminRouteHref("email-vorlagen"),
        icon: Mail,
      },
    ],
  },
]

const ALL_NAV_ITEMS = ADMIN_NAV_SECTIONS.flatMap((section) => {
  const items: AdminNavItem[] = []
  for (const item of section.items) {
    items.push(item)
    if (item.children) {
      for (const child of item.children) {
        items.push({
          id: child.id,
          label: child.label,
          href: child.href,
          icon: item.icon,
        })
      }
    }
  }
  return items
})

export function findAdminNavLabel(pathname: string): string {
  const match = matchAdminRoute(pathname)
  if (!match) return "Admin"
  const item = ALL_NAV_ITEMS.find((entry) => entry.id === match)
  return item?.label ?? "Admin"
}

/**
 * Mappt die aktuelle URL auf eine Admin-Route-ID (längster Match gewinnt).
 */
export function matchAdminRoute(pathname: string): AdminRouteId | null {
  const normalized = pathname.replace(/\/+$/, "") || pathname
  const base = adminPortalPath()
  if (normalized === base) return "dashboard"

  const entries = (Object.entries(ADMIN_ROUTE_PATHS) as Array<
    [AdminRouteId, string]
  >).sort((a, b) => b[1].length - a[1].length)

  for (const [id, path] of entries) {
    const full = adminPortalPath(path)
    if (normalized === full) return id
  }
  return null
}

/** Legacy `?tab=` → neuer Pfad (für E-Mails / Bookmarks). */
export const LEGACY_ADMIN_TAB_REDIRECTS: Record<string, string> = {
  stats: ADMIN_ROUTE_PATHS.dashboard,
  production: ADMIN_ROUTE_PATHS.produktionscockpit,
  customers: ADMIN_ROUTE_PATHS.kundenverwaltung,
  belege: ADMIN_ROUTE_PATHS.belege,
  orders: `${ADMIN_ROUTE_PATHS.belege}?view=orders`,
  products: ADMIN_ROUTE_PATHS.produkte,
  inventory: ADMIN_ROUTE_PATHS["produkte-lager"],
  accounting: ADMIN_ROUTE_PATHS.buchhaltung,
  coupons: ADMIN_ROUTE_PATHS.gutscheine,
  settings: ADMIN_ROUTE_PATHS["shop-einstellungen"],
  "site-texts": ADMIN_ROUTE_PATHS.edit,
  "print-calculator": ADMIN_ROUTE_PATHS.druckkalkulator,
  "ai-settings": ADMIN_ROUTE_PATHS["ki-modell"],
  "invoice-template": ADMIN_ROUTE_PATHS["dokumenten-vorlagen"],
}

export function isAdminNavActive(
  pathname: string,
  href: string,
  options?: { exact?: boolean }
): boolean {
  const path = pathname.replace(/\/+$/, "")
  const target = href.split("?")[0]!.replace(/\/+$/, "")
  if (options?.exact) return path === target
  if (path === target) return true
  // Nested: /produkte/lager should not mark /produkte as exclusive leaf,
  // but parent "Produkte" group stays open/highlighted via children check.
  return path.startsWith(`${target}/`)
}
