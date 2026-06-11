export const SUPPORTER_DOC_TYPE = "project-supporter"

export type ProjectSupporter = {
  id: string
  docType: typeof SUPPORTER_DOC_TYPE
  name: string
  email: string
  amountChf: number
  amountCents: number
  currency: "chf"
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

export const SUPPORT_MILESTONES = [
  {
    id: "materials",
    title: "Spezialmaterialien & Filamente",
    description:
      "Erweiterung unseres Filament-Sortiments mit Premium-Materialien für anspruchsvolle Projekte.",
    goalChf: 500,
  },
  {
    id: "printer",
    title: "Zusätzlicher High-Speed-Drucker",
    description:
      "Ein zweiter Hochgeschwindigkeits-Drucker für kürzere Lieferzeiten und mehr Kapazität.",
    goalChf: 1500,
  },
  {
    id: "laser",
    title: "Laser-Upgrade für Metallgravuren",
    description:
      "Upgrade unserer Laseranlage für präzise Gravuren auf Metall und gehärteten Oberflächen.",
    goalChf: 3000,
  },
] as const

export function computeMilestoneProgress(totalRaisedChf: number): SupportMilestone[] {
  let remaining = Math.max(0, totalRaisedChf)
  let previousUnlocked = true

  return SUPPORT_MILESTONES.map((milestone) => {
    const raisedChf = Math.min(remaining, milestone.goalChf)
    remaining = Math.max(0, remaining - milestone.goalChf)
    const unlocked = previousUnlocked
    previousUnlocked = previousUnlocked && raisedChf >= milestone.goalChf
    const progressPercent = unlocked
      ? Math.min(100, Math.round((raisedChf / milestone.goalChf) * 100))
      : 0
    const completed = unlocked && raisedChf >= milestone.goalChf

    return {
      ...milestone,
      raisedChf,
      progressPercent,
      unlocked,
      completed,
    }
  })
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
