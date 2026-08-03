export type AnnouncementBannerStyle = "unicolor" | "animated-gradient"

/**
 * Anzeigemodus der Ankündigungsleiste:
 * - "marquee": Alle aktiven Texte laufen als durchgehende Linie von rechts nach links.
 * - "rotate": Texte wechseln statisch nach X Sekunden.
 */
export type AnnouncementBannerDisplayMode = "marquee" | "rotate"

/** Ein einzelner, optional zeitlich begrenzter Banner-Text. */
export type AnnouncementBannerEntry = {
  id: string
  text: string
  discountCode: string
  linkUrl: string
  /** ISO/datetime-local String; leer/null = keine Startbegrenzung. */
  startAt: string | null
  /** ISO/datetime-local String; leer/null = keine Endbegrenzung. */
  endAt: string | null
}

export type AnnouncementBannerSettings = {
  active: boolean
  displayMode: AnnouncementBannerDisplayMode
  /** Rotationsintervall in Sekunden (nur displayMode "rotate"). */
  rotateSeconds: number
  style: AnnouncementBannerStyle
  /** Hintergrundfarbe für Unicolor (CSS-Farbe). */
  backgroundColor: string
  entries: AnnouncementBannerEntry[]
}

export const DEFAULT_ANNOUNCEMENT_ROTATE_SECONDS = 5
export const MIN_ANNOUNCEMENT_ROTATE_SECONDS = 2
export const MAX_ANNOUNCEMENT_ROTATE_SECONDS = 60

export const DEFAULT_ANNOUNCEMENT_BANNER: AnnouncementBannerSettings = {
  active: false,
  displayMode: "marquee",
  rotateSeconds: DEFAULT_ANNOUNCEMENT_ROTATE_SECONDS,
  style: "unicolor",
  backgroundColor: "#ea580c",
  entries: [],
}

function makeEntryId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
  } catch {
    /* ignore */
  }
  return `banner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeDateValue(input: unknown): string | null {
  if (typeof input !== "string") return null
  const trimmed = input.trim()
  if (!trimmed) return null
  // Nur plausibel parsebare Werte akzeptieren (datetime-local oder ISO).
  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) return null
  return trimmed.slice(0, 40)
}

function normalizeEntry(input: Partial<AnnouncementBannerEntry> | null | undefined): AnnouncementBannerEntry {
  return {
    id:
      typeof input?.id === "string" && input.id.trim().length > 0
        ? input.id.trim().slice(0, 64)
        : makeEntryId(),
    text: typeof input?.text === "string" ? input.text.trim().slice(0, 240) : "",
    discountCode:
      typeof input?.discountCode === "string"
        ? input.discountCode.trim().slice(0, 64)
        : "",
    linkUrl:
      typeof input?.linkUrl === "string" ? input.linkUrl.trim().slice(0, 500) : "",
    startAt: normalizeDateValue(input?.startAt),
    endAt: normalizeDateValue(input?.endAt),
  }
}

/**
 * Normalisiert die Banner-Einstellungen und migriert das frühere Einzel-Banner
 * (top-level `text`/`discountCode`/`linkUrl`) transparent in einen Eintrag.
 */
export function normalizeAnnouncementBanner(
  input?:
    | (Partial<AnnouncementBannerSettings> & {
        // Legacy-Einzelbanner-Felder
        text?: string
        discountCode?: string
        linkUrl?: string
      })
    | null
): AnnouncementBannerSettings {
  const style =
    input?.style === "animated-gradient" ? "animated-gradient" : "unicolor"
  const displayMode = input?.displayMode === "rotate" ? "rotate" : "marquee"

  let rotateSeconds = Number(input?.rotateSeconds)
  if (!Number.isFinite(rotateSeconds)) rotateSeconds = DEFAULT_ANNOUNCEMENT_ROTATE_SECONDS
  rotateSeconds = Math.round(
    Math.min(
      MAX_ANNOUNCEMENT_ROTATE_SECONDS,
      Math.max(MIN_ANNOUNCEMENT_ROTATE_SECONDS, rotateSeconds)
    )
  )

  let entries: AnnouncementBannerEntry[]
  if (Array.isArray(input?.entries)) {
    entries = input.entries.map((entry) => normalizeEntry(entry))
  } else if (typeof input?.text === "string" && input.text.trim().length > 0) {
    // Migration: altes Einzelbanner → ein Eintrag
    entries = [
      normalizeEntry({
        text: input.text,
        discountCode: input.discountCode,
        linkUrl: input.linkUrl,
      }),
    ]
  } else {
    entries = []
  }

  return {
    active: input?.active === true,
    displayMode,
    rotateSeconds,
    style,
    backgroundColor:
      typeof input?.backgroundColor === "string" &&
      input.backgroundColor.trim().length > 0
        ? input.backgroundColor.trim().slice(0, 40)
        : DEFAULT_ANNOUNCEMENT_BANNER.backgroundColor,
    entries,
  }
}

/** Prüft, ob ein Eintrag aktuell (Zeitfenster + nicht leer) angezeigt werden darf. */
export function isAnnouncementEntryActive(
  entry: AnnouncementBannerEntry,
  now: number = Date.now()
): boolean {
  if (!entry.text.trim()) return false
  if (entry.startAt) {
    const start = Date.parse(entry.startAt)
    if (!Number.isNaN(start) && now < start) return false
  }
  if (entry.endAt) {
    const end = Date.parse(entry.endAt)
    if (!Number.isNaN(end) && now > end) return false
  }
  return true
}

/** Liefert alle aktuell gültigen Banner-Einträge (leer, wenn Banner inaktiv). */
export function getActiveAnnouncementEntries(
  settings: AnnouncementBannerSettings,
  now: number = Date.now()
): AnnouncementBannerEntry[] {
  if (!settings.active) return []
  return settings.entries.filter((entry) => isAnnouncementEntryActive(entry, now))
}

/** Erzeugt einen leeren Eintrag (für den Admin-Editor). */
export function createEmptyAnnouncementEntry(): AnnouncementBannerEntry {
  return {
    id: makeEntryId(),
    text: "",
    discountCode: "",
    linkUrl: "",
    startAt: null,
    endAt: null,
  }
}
