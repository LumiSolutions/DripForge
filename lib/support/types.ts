import type { SupportMilestoneConfig } from "@/lib/dripforge/support-page-settings"
import {
  DEFAULT_SUPPORT_MILESTONES,
  getActiveSupportMilestones,
} from "@/lib/dripforge/support-page-settings"

export const SUPPORTER_DOC_TYPE = "project-supporter"

export type SupportCategoryId = "general" | "materials" | "printer" | "laser"

export type MilestoneId = "materials" | "printer" | "laser"

export type ProjectSupporter = {
  id: string
  docType: typeof SUPPORTER_DOC_TYPE
  name: string
  email: string
  amountChf: number
  amountCents: number
  currency: "chf"
  category: SupportCategoryId
  stripeSessionId: string
  stripePaymentIntentId?: string | null
  status: "completed" | "pending"
  createdAt: string
}

export type SupportMilestone = {
  id: string
  title: string
  description: string
  goalChf: number
  raisedChf: number
  progressPercent: number
  unlocked: boolean
  completed: boolean
}

export const SUPPORT_CATEGORIES: {
  id: SupportCategoryId
  label: string
  milestoneId?: MilestoneId
}[] = [
  {
    id: "general",
    label: "Allgemeine Entwicklung (Aufteilung nach Bedarf)",
  },
  {
    id: "materials",
    label: "Spezialmaterialien & Filamente",
    milestoneId: "materials",
  },
  {
    id: "printer",
    label: "Zusätzlicher High-Speed-Drucker",
    milestoneId: "printer",
  },
  {
    id: "laser",
    label: "Laser-Upgrade für Metallgravuren",
    milestoneId: "laser",
  },
]

export const SUPPORT_MILESTONES = [
  {
    id: "materials" as const,
    title: "Spezialmaterialien & Filamente",
    description:
      "Erweiterung unseres Filament-Sortiments mit Premium-Materialien für anspruchsvolle Projekte.",
    goalChf: 500,
    categoryId: "materials" as const,
  },
  {
    id: "printer" as const,
    title: "Zusätzlicher High-Speed-Drucker",
    description:
      "Ein zweiter Hochgeschwindigkeits-Drucker für kürzere Lieferzeiten und mehr Kapazität.",
    goalChf: 1500,
    categoryId: "printer" as const,
  },
  {
    id: "laser" as const,
    title: "Laser-Upgrade für Metallgravuren",
    description:
      "Upgrade unserer Laseranlage für präzise Gravuren auf Metall und gehärteten Oberflächen.",
    goalChf: 3000,
    categoryId: "laser" as const,
  },
]

export type SupportCategoryTotals = Record<SupportCategoryId, number>

export function emptyCategoryTotals(): SupportCategoryTotals {
  return { general: 0, materials: 0, printer: 0, laser: 0 }
}

export function normalizeSupportCategory(value: unknown): SupportCategoryId {
  const id = String(value ?? "general").trim() as SupportCategoryId
  if (SUPPORT_CATEGORIES.some((c) => c.id === id)) return id
  return "general"
}

export function milestoneIdToCategory(milestoneId: string): SupportCategoryId {
  const match = SUPPORT_MILESTONES.find((m) => m.id === milestoneId)
  return match?.categoryId ?? "general"
}

function isKnownCategoryMilestone(
  id: string
): id is Exclude<SupportCategoryId, "general"> {
  return id === "materials" || id === "printer" || id === "laser"
}

/**
 * Berechnet Fortschritt für Meilensteine.
 * Nutzt konfigurierte Meilensteine (Admin), Fallback auf Defaults.
 * Archivierte Meilensteine werden ausgeschlossen.
 */
export function computeMilestoneProgress(
  totals: SupportCategoryTotals = emptyCategoryTotals(),
  configs?: SupportMilestoneConfig[] | null
): SupportMilestone[] {
  const source =
    Array.isArray(configs) && configs.length > 0
      ? getActiveSupportMilestones(configs)
      : getActiveSupportMilestones(DEFAULT_SUPPORT_MILESTONES)

  const raisedByMilestone: Record<string, number> = {}
  for (const milestone of source) {
    raisedByMilestone[milestone.id] = isKnownCategoryMilestone(milestone.id)
      ? totals[milestone.id]
      : 0
  }

  let generalPool = totals.general
  for (const milestone of source) {
    const gap = Math.max(
      0,
      milestone.goalChf - (raisedByMilestone[milestone.id] ?? 0)
    )
    if (gap > 0 && generalPool > 0) {
      const allocated = Math.min(gap, generalPool)
      raisedByMilestone[milestone.id] =
        (raisedByMilestone[milestone.id] ?? 0) + allocated
      generalPool -= allocated
    }
  }

  let previousUnlocked = true

  return source.map((milestone) => {
    const raisedRaw = Math.min(
      raisedByMilestone[milestone.id] ?? 0,
      milestone.goalChf
    )
    let unlocked = previousUnlocked
    let completed = unlocked && raisedRaw >= milestone.goalChf

    if (milestone.status === "erreicht") {
      unlocked = true
      completed = true
    } else if (milestone.status === "in_arbeit") {
      unlocked = true
    }

    previousUnlocked = previousUnlocked && completed

    const raisedChf = completed ? milestone.goalChf : raisedRaw
    const progressPercent = unlocked
      ? completed
        ? 100
        : Math.min(
            100,
            Math.round((raisedRaw / Math.max(1, milestone.goalChf)) * 100)
          )
      : 0

    return {
      id: milestone.id,
      title: milestone.title,
      description: milestone.description,
      goalChf: milestone.goalChf,
      raisedChf,
      progressPercent,
      unlocked,
      completed,
    }
  })
}

export function totalRaisedFromCategories(totals: SupportCategoryTotals): number {
  return totals.general + totals.materials + totals.printer + totals.laser
}

export function normalizeSupporterAmountChf(value: unknown): number | null {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return null
  const rounded = Math.round(amount * 100) / 100
  if (rounded < 5 || rounded > 10_000) return null
  return rounded
}

export function normalizeSupporterName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .slice(0, 120)
}

export function normalizeSupporterEmail(value: unknown): string | null {
  const email = String(value ?? "")
    .trim()
    .toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email.slice(0, 254)
}

export function categoryLabel(category: SupportCategoryId): string {
  return SUPPORT_CATEGORIES.find((c) => c.id === category)?.label ?? category
}
