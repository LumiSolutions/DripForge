export const SEASONAL_THEME_TYPES = [
  "halloween",
  "christmas",
  "valentine",
  "easter",
  "summer",
  "custom",
] as const

export type SeasonalThemeType = (typeof SEASONAL_THEME_TYPES)[number]
export type SeasonalEffect = "none" | "snow" | "hearts" | "confetti" | "spooky"

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
}

export type SeasonalSettings = {
  themeEnabled: boolean
  activeEventId: string | null
  events: SeasonalEvent[]
}

export const DEFAULT_SEASONAL_EVENTS: SeasonalEvent[] = [
  {
    id: "halloween",
    name: "Halloween",
    themeType: "halloween",
    enabled: true,
    accentColor: "#f97316",
    badgeLabel: "Limited Edition 🎃",
    effect: "spooky",
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
    effect: "confetti",
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
    value === "none" ||
    value === "snow" ||
    value === "hearts" ||
    value === "confetti" ||
    value === "spooky"
  )
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

  return {
    id: id || fallback?.id || "season-event",
    name,
    themeType,
    enabled: input.enabled !== false,
    accentColor: cleanString(input.accentColor, fallback?.accentColor ?? "#f97316"),
    badgeLabel: cleanString(input.badgeLabel, fallback?.badgeLabel ?? `Limited Edition – ${name}`),
    effect: isEffect(input.effect) ? input.effect : fallback?.effect ?? "none",
    heroOverlay:
      typeof input.heroOverlay === "boolean"
        ? input.heroOverlay
        : fallback?.heroOverlay ?? true,
    startsAt: cleanDate(input.startsAt) ?? fallback?.startsAt ?? null,
    endsAt: cleanDate(input.endsAt) ?? fallback?.endsAt ?? null,
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
    const normalized = normalizeSeasonalEvent(event as Partial<SeasonalEvent>, byId.get(String((event as SeasonalEvent).id)))
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
