import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import { DEFAULT_SERVICE_VISIBILITY } from "@/lib/admin/types"
import { navItems } from "@/lib/dripforge/data"

export const SERVICE_TOGGLE_OPTIONS: {
  key: keyof ServiceVisibilitySettings
  label: string
  description: string
}[] = [
  {
    key: "druck3d",
    label: "3D-Druck aktivieren",
    description: "Navigation, Startseite, individueller 3D-Druck und Shop-Filter.",
  },
  {
    key: "lasergravur",
    label: "Lasergravur aktivieren",
    description: "Navigation, Startseite, Laser-Seite (Gravur), Shop-Laser und Konfigurator.",
  },
  {
    key: "laserschnitt",
    label: "Laserschnitt aktivieren",
    description: "Kachel «Laserschnitt» unter «Unsere Möglichkeiten» auf der Laser-Seite.",
  },
  {
    key: "markierungAetzung",
    label: "Markierung & Ätzung aktivieren",
    description: "Kachel «Markierung & Ätzung» unter «Unsere Möglichkeiten» auf der Laser-Seite.",
  },
]

export function normalizeServiceVisibility(
  input?: Partial<ServiceVisibilitySettings> | null
): ServiceVisibilitySettings {
  return {
    druck3d: input?.druck3d ?? DEFAULT_SERVICE_VISIBILITY.druck3d,
    lasergravur: input?.lasergravur ?? DEFAULT_SERVICE_VISIBILITY.lasergravur,
    laserschnitt: input?.laserschnitt ?? DEFAULT_SERVICE_VISIBILITY.laserschnitt,
    markierungAetzung:
      input?.markierungAetzung ?? DEFAULT_SERVICE_VISIBILITY.markierungAetzung,
  }
}

export function isLaserNavVisible(s: ServiceVisibilitySettings): boolean {
  return s.lasergravur || s.laserschnitt || s.markierungAetzung
}

export function isShopNavVisible(s: ServiceVisibilitySettings): boolean {
  return s.druck3d || s.lasergravur
}

export function filterNavItems(s: ServiceVisibilitySettings) {
  return navItems.filter((item) => {
    if (item.id === "3d-druck") return s.druck3d
    if (item.id === "laser") return isLaserNavVisible(s)
    if (item.id === "shop") return isShopNavVisible(s)
    return true
  })
}

export function isViewAllowed(
  view: string,
  s: ServiceVisibilitySettings,
  options?: { aiEnabled?: boolean }
): boolean {
  switch (view) {
    case "3d-druck":
    case "individual-3d":
      return s.druck3d
    case "ai-konfigurator":
      return s.druck3d && Boolean(options?.aiEnabled)
    case "laser":
      return isLaserNavVisible(s)
    case "individual-laser":
      return s.lasergravur
    case "shop":
      return isShopNavVisible(s)
    default:
      return true
  }
}

export type LaserCapabilityId =
  | "lasergravur"
  | "laserschnitt"
  | "markierungAetzung"

export function isLaserCapabilityVisible(
  id: LaserCapabilityId,
  s: ServiceVisibilitySettings
): boolean {
  return s[id]
}
