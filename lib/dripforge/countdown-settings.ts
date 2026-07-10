import type { CountdownTemplateId, LaunchSettings } from "@/lib/admin/types"
import { DEFAULT_LAUNCH_SETTINGS } from "@/lib/admin/types"
import { LAUNCH_DATE, LAUNCH_DATE_ISO } from "@/lib/dripforge/launch-config"

export type { CountdownTemplateId }

export const COUNTDOWN_TEMPLATE_OPTIONS: {
  id: CountdownTemplateId
  label: string
}[] = [
  { id: "website_launch", label: "Website Launch" },
  { id: "shop_update", label: "Shop Update / Wartungsarbeiten" },
]

export const DEFAULT_COUNTDOWN_LABEL = DEFAULT_LAUNCH_SETTINGS.countdownLabel
export const DEFAULT_COUNTDOWN_TARGET_ISO = LAUNCH_DATE.toISOString()
export const DEFAULT_COUNTDOWN_HERO = "/images/launch-hero.png"

export type CountdownTemplateContent = {
  teaser: string
  title: string
  pastMessage: string
  templateClass: "cs-template-launch" | "cs-template-update"
}

export type PublicCountdownConfig = {
  template: CountdownTemplateId
  label: string
  targetAt: string
  heroImageUrl: string
  teaser: string
  title: string
  pastMessage: string
  templateClass: CountdownTemplateContent["templateClass"]
}

export function normalizeCountdownTemplate(value: unknown): CountdownTemplateId {
  return value === "shop_update" ? "shop_update" : "website_launch"
}

export function normalizeCountdownLabel(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_COUNTDOWN_LABEL
  const trimmed = value.trim()
  return trimmed.slice(0, 120) || DEFAULT_COUNTDOWN_LABEL
}

export function normalizeCountdownTargetAt(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_COUNTDOWN_TARGET_ISO
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return DEFAULT_COUNTDOWN_TARGET_ISO
  }
  return parsed.toISOString()
}

export function normalizeCountdownHeroImageUrl(value: unknown): string | null {
  if (value == null || value === "") return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

export function normalizeLaunchSettings(
  input?: Partial<LaunchSettings> | null
): LaunchSettings {
  return {
    shopLive: input?.shopLive === true,
    countdownTemplate: normalizeCountdownTemplate(input?.countdownTemplate),
    countdownLabel: normalizeCountdownLabel(input?.countdownLabel),
    targetAt: normalizeCountdownTargetAt(input?.targetAt),
    heroImageUrl: normalizeCountdownHeroImageUrl(input?.heroImageUrl),
  }
}

export function getCountdownTemplateContent(
  template: CountdownTemplateId
): CountdownTemplateContent {
  if (template === "shop_update") {
    return {
      teaser: "Wir bringen DripForge auf das nächste Level",
      title: "Shop-Update — wir sind gleich wieder für Sie da",
      pastMessage:
        "Das Update ist abgeschlossen — Vorschau-Zugang oder Live-Schaltung folgt in Kürze.",
      templateClass: "cs-template-update",
    }
  }

  return {
    teaser: "Hier entsteht DripForge",
    title: "Präziser 3D-Druck & Lasergravur aus der Schweiz",
    pastMessage: "Der Countdown ist abgelaufen — wir gehen in Kürze live.",
    templateClass: "cs-template-launch",
  }
}

export function resolveCountdownHeroImageUrl(url?: string | null): string {
  const trimmed = url?.trim()
  return trimmed || DEFAULT_COUNTDOWN_HERO
}

export function shouldUseUnoptimizedCountdownHero(url: string): boolean {
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  )
}

export function buildPublicCountdownConfig(
  launch: Partial<LaunchSettings> | null | undefined
): PublicCountdownConfig {
  const normalized = normalizeLaunchSettings(launch)
  const templateContent = getCountdownTemplateContent(normalized.countdownTemplate)

  return {
    template: normalized.countdownTemplate,
    label: normalized.countdownLabel,
    targetAt: normalized.targetAt,
    heroImageUrl: resolveCountdownHeroImageUrl(normalized.heroImageUrl),
    teaser: templateContent.teaser,
    title: templateContent.title,
    pastMessage: templateContent.pastMessage,
    templateClass: templateContent.templateClass,
  }
}

export function getCountdownForTarget(
  targetAt: string | Date,
  now = Date.now()
): {
  totalMs: number
  days: number
  hours: number
  minutes: number
  seconds: number
  isPast: boolean
} {
  const target =
    typeof targetAt === "string" ? new Date(targetAt) : targetAt
  const targetMs = target.getTime()
  const totalMs = Number.isNaN(targetMs) ? 0 : targetMs - now
  const isPast = totalMs <= 0
  const abs = Math.max(0, totalMs)

  return {
    totalMs,
    isPast,
    days: Math.floor(abs / (1000 * 60 * 60 * 24)),
    hours: Math.floor((abs / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((abs / (1000 * 60)) % 60),
    seconds: Math.floor((abs / 1000) % 60),
  }
}

/** Für `<input type="datetime-local" />` (lokale Zeitzone). */
export function toDatetimeLocalInput(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDatetimeLocalInput(value: string): string {
  if (!value.trim()) return DEFAULT_COUNTDOWN_TARGET_ISO
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return DEFAULT_COUNTDOWN_TARGET_ISO
  return parsed.toISOString()
}

/** Legacy-Fallback für Middleware und alte Aufrufer. */
export { LAUNCH_DATE_ISO }
