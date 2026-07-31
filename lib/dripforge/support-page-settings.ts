export type SupportPageSettings = {
  showSupportOnMainSite: boolean
  showSupportOnCountdownPage: boolean
}

export type SupportMilestoneStatus =
  | "geplant"
  | "in_arbeit"
  | "erreicht"
  | "archiviert"

export type SupportMilestoneConfig = {
  id: string
  title: string
  description: string
  goalChf: number
  status: SupportMilestoneStatus
  sortOrder: number
}

export type SupportFeatureItem = {
  id: string
  title: string
  description: string
  archived: boolean
  sortOrder: number
}

const MILESTONE_STATUSES: SupportMilestoneStatus[] = [
  "geplant",
  "in_arbeit",
  "erreicht",
  "archiviert",
]

function resolveSupportFlag(value: unknown, legacyFallback: boolean): boolean {
  if (value === true) return true
  if (value === false) return false
  return legacyFallback
}

export function buildSupportPageSettings(
  input?: {
    showSupportOnMainSite?: unknown
    showSupportOnCountdownPage?: unknown
    /** @deprecated Legacy-Feld — wird bei fehlenden neuen Flags als Fallback genutzt */
    isSupportPageActive?: unknown
  } | null
): SupportPageSettings {
  const legacy = input?.isSupportPageActive === true

  return {
    showSupportOnMainSite: resolveSupportFlag(
      input?.showSupportOnMainSite,
      legacy
    ),
    showSupportOnCountdownPage: resolveSupportFlag(
      input?.showSupportOnCountdownPage,
      legacy
    ),
  }
}

function normalizeMilestoneStatus(value: unknown): SupportMilestoneStatus {
  const status = String(value ?? "geplant").trim() as SupportMilestoneStatus
  if (MILESTONE_STATUSES.includes(status)) return status
  return "geplant"
}

function normalizeGoalChf(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 100
  return Math.round(n * 100) / 100
}

function newSupportId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Default-Meilensteine (entspricht den bisherigen statischen SUPPORT_MILESTONES). */
export const DEFAULT_SUPPORT_MILESTONES: SupportMilestoneConfig[] = [
  {
    id: "materials",
    title: "Spezialmaterialien & Filamente",
    description:
      "Erweiterung unseres Filament-Sortiments mit Premium-Materialien für anspruchsvolle Projekte.",
    goalChf: 500,
    status: "geplant",
    sortOrder: 0,
  },
  {
    id: "printer",
    title: "Zusätzlicher High-Speed-Drucker",
    description:
      "Ein zweiter Hochgeschwindigkeits-Drucker für kürzere Lieferzeiten und mehr Kapazität.",
    goalChf: 1500,
    status: "geplant",
    sortOrder: 1,
  },
  {
    id: "laser",
    title: "Laser-Upgrade für Metallgravuren",
    description:
      "Upgrade unserer Laseranlage für präzise Gravuren auf Metall und gehärteten Oberflächen.",
    goalChf: 3000,
    status: "geplant",
    sortOrder: 2,
  },
]

export const DEFAULT_SUPPORT_FEATURES: SupportFeatureItem[] = []

export function createSupportMilestoneConfig(
  overrides?: Partial<SupportMilestoneConfig>
): SupportMilestoneConfig {
  return {
    id: overrides?.id ?? newSupportId("milestone"),
    title: overrides?.title?.trim() || "Neuer Meilenstein",
    description: overrides?.description?.trim() || "",
    goalChf: normalizeGoalChf(overrides?.goalChf ?? 500),
    status: normalizeMilestoneStatus(overrides?.status ?? "geplant"),
    sortOrder:
      typeof overrides?.sortOrder === "number" && Number.isFinite(overrides.sortOrder)
        ? overrides.sortOrder
        : 0,
  }
}

export function createSupportFeatureItem(
  overrides?: Partial<SupportFeatureItem>
): SupportFeatureItem {
  return {
    id: overrides?.id ?? newSupportId("feature"),
    title: overrides?.title?.trim() || "Neues Feature",
    description: overrides?.description?.trim() || "",
    archived: overrides?.archived === true,
    sortOrder:
      typeof overrides?.sortOrder === "number" && Number.isFinite(overrides.sortOrder)
        ? overrides.sortOrder
        : 0,
  }
}

export function normalizeSupportMilestones(
  input?: unknown
): SupportMilestoneConfig[] {
  if (!Array.isArray(input) || input.length === 0) {
    return DEFAULT_SUPPORT_MILESTONES.map((m) => ({ ...m }))
  }

  const normalized = input
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") return null
      const item = raw as Record<string, unknown>
      const id = String(item.id ?? "").trim()
      if (!id) return null
      return {
        id,
        title: String(item.title ?? "").trim() || "Meilenstein",
        description: String(item.description ?? "").trim(),
        goalChf: normalizeGoalChf(item.goalChf),
        status: normalizeMilestoneStatus(item.status),
        sortOrder:
          typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder)
            ? item.sortOrder
            : index,
      } satisfies SupportMilestoneConfig
    })
    .filter((item): item is SupportMilestoneConfig => item != null)

  if (normalized.length === 0) {
    return DEFAULT_SUPPORT_MILESTONES.map((m) => ({ ...m }))
  }

  return normalized.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
  )
}

export function normalizeSupportFeatures(
  input?: unknown
): SupportFeatureItem[] {
  if (!Array.isArray(input)) {
    return DEFAULT_SUPPORT_FEATURES.map((f) => ({ ...f }))
  }

  const normalized = input
    .map((raw, index) => {
      if (!raw || typeof raw !== "object") return null
      const item = raw as Record<string, unknown>
      const id = String(item.id ?? "").trim()
      if (!id) return null
      return {
        id,
        title: String(item.title ?? "").trim() || "Feature",
        description: String(item.description ?? "").trim(),
        archived: item.archived === true,
        sortOrder:
          typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder)
            ? item.sortOrder
            : index,
      } satisfies SupportFeatureItem
    })
    .filter((item): item is SupportFeatureItem => item != null)

  return normalized.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)
  )
}

/** Aktive (nicht archivierte) Meilensteine für die öffentliche Fortschrittsliste. */
export function getActiveSupportMilestones(
  input?: unknown
): SupportMilestoneConfig[] {
  return normalizeSupportMilestones(input).filter((m) => m.status !== "archiviert")
}

/** Nicht archivierte Features für die Storefront. */
export function getPublicSupportFeatures(
  input?: unknown
): SupportFeatureItem[] {
  return normalizeSupportFeatures(input).filter((f) => !f.archived)
}
