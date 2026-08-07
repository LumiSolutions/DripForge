export const SEASONAL_THEME_TYPES = [
  "halloween",
  "christmas",
  "valentine",
  "easter",
  "summer",
  "blackFriday",
  "newYear",
  "spring",
  "custom",
] as const

export type SeasonalThemeType = (typeof SEASONAL_THEME_TYPES)[number]

export const SEASONAL_EFFECTS = [
  "none",
  "snow",
  "hearts",
  "confetti",
  "spooky",
  "fireworks",
  "flowers",
  "blackFriday",
  "pumpkins",
  "custom",
] as const

export type SeasonalEffect = (typeof SEASONAL_EFFECTS)[number]

export type SeasonalCustomParticles = {
  glyphs: string
  density: number
  speed: number
  color: string
}

export type SeasonalEvent = {
  id: string
  name: string
  themeType: SeasonalThemeType
  enabled: boolean
  accentColor: string
  badgeLabel: string
  effect: SeasonalEffect
  heroOverlay: boolean
  startsAt?: string | null
  endsAt?: string | null
  customParticles?: SeasonalCustomParticles | null
}

export type SeasonalSettings = {
  themeEnabled: boolean
  activeEventId: string | null
  events: SeasonalEvent[]
}

export const DEFAULT_CUSTOM_PARTICLES: SeasonalCustomParticles = {
  glyphs: "✦ ★ ✧",
  density: 18,
  speed: 1,
  color: "#f97316",
}

export const DEFAULT_SEASONAL_EVENTS: SeasonalEvent[] = [
  {
    id: "halloween",
    name: "Halloween",
    themeType: "halloween",
    enabled: true,
    accentColor: "#f97316",
    badgeLabel: "Limited Edition 🎃",
    effect: "pumpkins",
    heroOverlay: true,
  },
  {
    id: "christmas",
    name: "Weihnachten",
    themeType: "christmas",
    enabled: true,
    accentColor: "#dc2626",
    badgeLabel: "Weihnachts-Special ❄️",
    effect: "snow",
    heroOverlay: true,
  },
  {
    id: "valentine",
    name: "Valentinstag",
    themeType: "valentine",
    enabled: true,
    accentColor: "#ec4899",
    badgeLabel: "Valentins-Special ♥",
    effect: "hearts",
    heroOverlay: true,
  },
  {
    id: "easter",
    name: "Ostern",
    themeType: "easter",
    enabled: true,
    accentColor: "#84cc16",
    badgeLabel: "Oster-Special",
    effect: "flowers",
    heroOverlay: true,
  },
  {
    id: "summer",
    name: "Sommer-Special",
    themeType: "summer",
    enabled: true,
    accentColor: "#0ea5e9",
    badgeLabel: "Sommer Limited",
    effect: "confetti",
    heroOverlay: true,
  },
  {
    id: "black-friday",
    name: "Black Friday",
    themeType: "blackFriday",
    enabled: true,
    accentColor: "#a855f7",
    badgeLabel: "Black Friday Deal",
    effect: "blackFriday",
    heroOverlay: true,
  },
  {
    id: "new-year",
    name: "Silvester",
    themeType: "newYear",
    enabled: true,
    accentColor: "#fbbf24",
    badgeLabel: "Silvester Special",
    effect: "fireworks",
    heroOverlay: true,
  },
  {
    id: "spring",
    name: "Frühling / Muttertag",
    themeType: "spring",
    enabled: true,
    accentColor: "#f472b6",
    badgeLabel: "Frühlings-Special",
    effect: "flowers",
    heroOverlay: true,
  },
]

export const DEFAULT_SEASONAL_SETTINGS: SeasonalSettings = {
  themeEnabled: false,
  activeEventId: null,
  events: DEFAULT_SEASONAL_EVENTS,
}

function cleanString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function cleanDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? value : null
}

function isThemeType(value: unknown): value is SeasonalThemeType {
  return (
    typeof value === "string" &&
    (SEASONAL_THEME_TYPES as readonly string[]).includes(value)
  )
}

function isEffect(value: unknown): value is SeasonalEffect {
  return (
    typeof value === "string" &&
    (SEASONAL_EFFECTS as readonly string[]).includes(value)
  )
}

export function normalizeCustomParticles(
  input: unknown,
  fallback?: SeasonalCustomParticles | null
): SeasonalCustomParticles {
  const raw =
    input && typeof input === "object"
      ? (input as Partial<SeasonalCustomParticles>)
      : {}
  const base = fallback ?? DEFAULT_CUSTOM_PARTICLES
  const density = Number(raw.density)
  const speed = Number(raw.speed)
  return {
    glyphs: cleanString(raw.glyphs, base.glyphs).slice(0, 48),
    density: Number.isFinite(density)
      ? Math.min(40, Math.max(4, Math.round(density)))
      : base.density,
    speed: Number.isFinite(speed)
      ? Math.min(2.5, Math.max(0.4, speed))
      : base.speed,
    color: cleanString(raw.color, base.color),
  }
}

export function normalizeSeasonalEvent(
  input: Partial<SeasonalEvent>,
  fallback?: SeasonalEvent
): SeasonalEvent {
  const themeType = isThemeType(input.themeType)
    ? input.themeType
    : fallback?.themeType ?? "custom"
  const name = cleanString(input.name, fallback?.name ?? "Saison-Event")
  const id = cleanString(input.id, fallback?.id ?? `season-${Date.now().toString(36)}`)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")

  const effect = isEffect(input.effect)
    ? input.effect
    : fallback?.effect ?? "none"

  // Migrate old spooky → pumpkins for halloween defaults
  const resolvedEffect =
    effect === "spooky" && themeType === "halloween" ? "pumpkins" : effect

  return {
    id: id || fallback?.id || "season-event",
    name,
    themeType,
    enabled: input.enabled !== false,
    accentColor: cleanString(input.accentColor, fallback?.accentColor ?? "#f97316"),
    badgeLabel: cleanString(
      input.badgeLabel,
      fallback?.badgeLabel ?? `Limited Edition – ${name}`
    ),
    effect: resolvedEffect,
    heroOverlay:
      typeof input.heroOverlay === "boolean"
        ? input.heroOverlay
        : fallback?.heroOverlay ?? true,
    startsAt: cleanDate(input.startsAt) ?? fallback?.startsAt ?? null,
    endsAt: cleanDate(input.endsAt) ?? fallback?.endsAt ?? null,
    customParticles:
      resolvedEffect === "custom" || input.customParticles != null
        ? normalizeCustomParticles(
            input.customParticles,
            fallback?.customParticles
          )
        : fallback?.customParticles ?? null,
  }
}

export function normalizeSeasonalSettings(input: unknown): SeasonalSettings {
  const raw =
    input && typeof input === "object"
      ? (input as Partial<SeasonalSettings>)
      : {}
  const customEvents = Array.isArray(raw.events) ? raw.events : []
  const byId = new Map(DEFAULT_SEASONAL_EVENTS.map((event) => [event.id, event]))
  for (const event of customEvents) {
    const normalized = normalizeSeasonalEvent(
      event as Partial<SeasonalEvent>,
      byId.get(String((event as SeasonalEvent).id))
    )
    byId.set(normalized.id, normalized)
  }
  const events = [...byId.values()]
  const activeEventId =
    typeof raw.activeEventId === "string" &&
    events.some((event) => event.id === raw.activeEventId)
      ? raw.activeEventId
      : null

  return {
    themeEnabled: raw.themeEnabled === true,
    activeEventId,
    events,
  }
}

export function resolveActiveSeasonalEvent(
  settings: SeasonalSettings,
  now = new Date()
): SeasonalEvent | null {
  if (!settings.themeEnabled || !settings.activeEventId) return null
  const event = settings.events.find((entry) => entry.id === settings.activeEventId)
  if (!event?.enabled) return null
  const nowMs = now.getTime()
  if (event.startsAt && new Date(event.startsAt).getTime() > nowMs) return null
  if (event.endsAt && new Date(event.endsAt).getTime() < nowMs) return null
  return event
}

export function resolveSeasonalGlyphs(event: SeasonalEvent): string[] {
  if (event.effect === "custom" && event.customParticles?.glyphs) {
    return event.customParticles.glyphs
      .split(/\s+/)
      .map((g) => g.trim())
      .filter(Boolean)
  }
  switch (event.effect) {
    case "snow":
      return ["❄", "❅", "❆"]
    case "hearts":
      return ["♥", "❤", "❥"]
    case "flowers":
      return ["❀", "✿", "❁", "✾"]
    case "fireworks":
      return ["✦", "✧", "⋆", "✺"]
    case "pumpkins":
      return ["🎃", "🕸", "🦇"]
    case "blackFriday":
      return ["%", "◆", "■"]
    case "spooky":
      return ["✦", "☠", "☾"]
    case "confetti":
      return ["•", "◆", "▴"]
    default:
      return ["•"]
  }
}
