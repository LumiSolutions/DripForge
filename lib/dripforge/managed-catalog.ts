import type {
  ServiceVisibilitySettings,
  ShopConfiguratorSettings,
} from "@/lib/admin/types"
import {
  DEFAULT_SERVICE_VISIBILITY,
  DEFAULT_SHOP_CONFIGURATORS,
} from "@/lib/admin/types"
import { SERVICE_TOGGLE_OPTIONS } from "@/lib/dripforge/service-visibility"
import { SHOP_CONFIGURATOR_TOGGLE_OPTIONS } from "@/lib/dripforge/shop-configurators"

export type ManagedCatalogKind = "service" | "configurator"

export type ManagedCatalogItem = {
  id: string
  kind: ManagedCatalogKind
  label: string
  description: string
  enabled: boolean
  /** Maps to built-in ServiceVisibilitySettings / ShopConfiguratorSettings keys when set */
  builtinServiceKey?: "druck3d" | "lasergravur" | "laserschnitt" | "markierungAetzung"
  builtinConfiguratorKey?: "custom3d" | "customLaser"
  /** Custom laser capability tile fields (for custom services shown on laser page) */
  features?: string[]
  sortOrder: number
  /** false for built-in system entries — cannot delete, only disable/edit label/description */
  system: boolean
}

const BUILTIN_SERVICE_KEYS = [
  "druck3d",
  "lasergravur",
  "laserschnitt",
  "markierungAetzung",
] as const

const BUILTIN_CONFIGURATOR_KEYS = ["custom3d", "customLaser"] as const

function isBuiltinServiceKey(
  value: unknown
): value is ManagedCatalogItem["builtinServiceKey"] {
  return (
    typeof value === "string" &&
    (BUILTIN_SERVICE_KEYS as readonly string[]).includes(value)
  )
}

function isBuiltinConfiguratorKey(
  value: unknown
): value is ManagedCatalogItem["builtinConfiguratorKey"] {
  return (
    typeof value === "string" &&
    (BUILTIN_CONFIGURATOR_KEYS as readonly string[]).includes(value)
  )
}

export const DEFAULT_MANAGED_CATALOG: ManagedCatalogItem[] = [
  ...SERVICE_TOGGLE_OPTIONS.map((option, index) => ({
    id: `system-service-${option.key}`,
    kind: "service" as const,
    label: option.label,
    description: option.description,
    enabled: DEFAULT_SERVICE_VISIBILITY[option.key],
    builtinServiceKey: option.key,
    sortOrder: index,
    system: true,
  })),
  ...SHOP_CONFIGURATOR_TOGGLE_OPTIONS.map((option, index) => ({
    id: `system-configurator-${option.key}`,
    kind: "configurator" as const,
    label: option.label,
    description: option.description,
    enabled: DEFAULT_SHOP_CONFIGURATORS[option.key],
    builtinConfiguratorKey: option.key,
    sortOrder: SERVICE_TOGGLE_OPTIONS.length + index,
    system: true,
  })),
]

function sanitizeFeatures(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const features = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
  return features.length > 0 ? features : undefined
}

function sanitizeCatalogItem(
  raw: unknown,
  fallbackSortOrder: number
): ManagedCatalogItem | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Partial<ManagedCatalogItem>
  const id = typeof item.id === "string" ? item.id.trim() : ""
  if (!id) return null

  const kind: ManagedCatalogKind =
    item.kind === "configurator" ? "configurator" : "service"
  const system = item.system === true
  const label =
    typeof item.label === "string" && item.label.trim()
      ? item.label.trim()
      : kind === "service"
        ? "Neue Dienstleistung"
        : "Neuer Konfigurator"
  const description =
    typeof item.description === "string" ? item.description.trim() : ""

  const builtinServiceKey = isBuiltinServiceKey(item.builtinServiceKey)
    ? item.builtinServiceKey
    : undefined
  const builtinConfiguratorKey = isBuiltinConfiguratorKey(
    item.builtinConfiguratorKey
  )
    ? item.builtinConfiguratorKey
    : undefined

  return {
    id,
    kind,
    label,
    description,
    enabled: item.enabled !== false,
    ...(builtinServiceKey ? { builtinServiceKey } : {}),
    ...(builtinConfiguratorKey ? { builtinConfiguratorKey } : {}),
    features: sanitizeFeatures(item.features),
    sortOrder:
      typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder)
        ? item.sortOrder
        : fallbackSortOrder,
    system,
  }
}

/**
 * Merge stored catalog with system defaults and sync enabled flags from
 * services / shopConfigurators for built-in keys when provided.
 */
export function normalizeManagedCatalog(
  input?: ManagedCatalogItem[] | null,
  services?: Partial<ServiceVisibilitySettings> | null,
  shopConfigurators?: Partial<ShopConfiguratorSettings> | null
): ManagedCatalogItem[] {
  const rawItems = Array.isArray(input) ? input : []
  const byId = new Map<string, ManagedCatalogItem>()
  const customItems: ManagedCatalogItem[] = []

  rawItems.forEach((raw, index) => {
    const item = sanitizeCatalogItem(raw, 1000 + index)
    if (!item) return
    if (item.system || item.builtinServiceKey || item.builtinConfiguratorKey) {
      byId.set(item.id, item)
      if (item.builtinServiceKey) {
        byId.set(`system-service-${item.builtinServiceKey}`, item)
      }
      if (item.builtinConfiguratorKey) {
        byId.set(`system-configurator-${item.builtinConfiguratorKey}`, item)
      }
    } else {
      customItems.push({ ...item, system: false })
    }
  })

  const mergedSystem = DEFAULT_MANAGED_CATALOG.map((defaultItem) => {
    const stored =
      byId.get(defaultItem.id) ??
      (defaultItem.builtinServiceKey
        ? byId.get(`system-service-${defaultItem.builtinServiceKey}`)
        : undefined) ??
      (defaultItem.builtinConfiguratorKey
        ? byId.get(`system-configurator-${defaultItem.builtinConfiguratorKey}`)
        : undefined)

    let enabled = stored?.enabled ?? defaultItem.enabled

    if (defaultItem.builtinServiceKey && services) {
      const flag = services[defaultItem.builtinServiceKey]
      if (typeof flag === "boolean") enabled = flag
    }
    if (defaultItem.builtinConfiguratorKey && shopConfigurators) {
      const flag = shopConfigurators[defaultItem.builtinConfiguratorKey]
      if (typeof flag === "boolean") enabled = flag
    }

    return {
      ...defaultItem,
      label: stored?.label?.trim() || defaultItem.label,
      description:
        typeof stored?.description === "string"
          ? stored.description
          : defaultItem.description,
      enabled,
      features: stored?.features ?? defaultItem.features,
      sortOrder: stored?.sortOrder ?? defaultItem.sortOrder,
      system: true,
    }
  })

  const systemIds = new Set(mergedSystem.map((item) => item.id))
  const systemBuiltinServiceKeys = new Set(
    mergedSystem
      .map((item) => item.builtinServiceKey)
      .filter(Boolean) as string[]
  )
  const systemBuiltinConfiguratorKeys = new Set(
    mergedSystem
      .map((item) => item.builtinConfiguratorKey)
      .filter(Boolean) as string[]
  )

  const dedupedCustom = customItems.filter((item) => {
    if (systemIds.has(item.id)) return false
    if (
      item.builtinServiceKey &&
      systemBuiltinServiceKeys.has(item.builtinServiceKey)
    ) {
      return false
    }
    if (
      item.builtinConfiguratorKey &&
      systemBuiltinConfiguratorKeys.has(item.builtinConfiguratorKey)
    ) {
      return false
    }
    return true
  })

  return [...mergedSystem, ...dedupedCustom].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
  )
}

/** Derive visibility flags + normalized catalog for persistence. */
export function applyManagedCatalogToSettings(
  catalog: ManagedCatalogItem[]
): {
  services: ServiceVisibilitySettings
  shopConfigurators: ShopConfiguratorSettings
  managedCatalog: ManagedCatalogItem[]
} {
  const normalized = normalizeManagedCatalog(catalog)

  const services: ServiceVisibilitySettings = {
    ...DEFAULT_SERVICE_VISIBILITY,
  }
  const shopConfigurators: ShopConfiguratorSettings = {
    ...DEFAULT_SHOP_CONFIGURATORS,
  }

  for (const item of normalized) {
    if (item.builtinServiceKey) {
      services[item.builtinServiceKey] = item.enabled
    }
    if (item.builtinConfiguratorKey) {
      shopConfigurators[item.builtinConfiguratorKey] = item.enabled
    }
  }

  return {
    services,
    shopConfigurators,
    managedCatalog: normalizeManagedCatalog(
      normalized,
      services,
      shopConfigurators
    ),
  }
}

/** Custom non-system service items that are enabled (for laser storefront tiles). */
export function getEnabledCustomLaserCapabilities(
  catalog: ManagedCatalogItem[] | null | undefined
): ManagedCatalogItem[] {
  return normalizeManagedCatalog(catalog)
    .filter(
      (item) => item.kind === "service" && !item.system && item.enabled
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
}

export function createManagedCatalogItem(
  kind: ManagedCatalogKind
): ManagedCatalogItem {
  const now = Date.now()
  const existingMax = DEFAULT_MANAGED_CATALOG.reduce(
    (max, item) => Math.max(max, item.sortOrder),
    0
  )
  return {
    id: kind === "service" ? `svc-${now}` : `cfg-${now}`,
    kind,
    label:
      kind === "service" ? "Neue Dienstleistung" : "Neuer Konfigurator",
    description: "",
    enabled: true,
    features: kind === "service" ? [] : undefined,
    sortOrder: existingMax + 10 + (kind === "service" ? 1 : 2),
    system: false,
  }
}
