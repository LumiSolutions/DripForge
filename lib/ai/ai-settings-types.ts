export const AI_SETTINGS_DOC_TYPE = "ai-settings"
export const AI_SETTINGS_DOC_ID = "ai-settings"

export const AI_PRODUCT_CATEGORIES = ["lampen"] as const
export type AiProductCategoryId = (typeof AI_PRODUCT_CATEGORIES)[number]

export type AiCutoutSpec = {
  id: string
  label: string
  diameterMm: number | null
  widthMm: number | null
  heightMm: number | null
  depthMm: number | null
  notes: string
}

export type AiPrintVolumeMm = {
  x: number
  y: number
  z: number
}

export type AiCategoryConfig = {
  id: AiProductCategoryId
  name: string
  enabled: boolean
  systemPrompt: string
  cutouts: AiCutoutSpec[]
  maxPrintSizeMm: AiPrintVolumeMm
}

export type AiSettingsDocument = {
  categories: AiCategoryConfig[]
  updatedAt: string
}

/** Bambu Lab X1C — Standard-Bauraum (mm). */
export const BAMBU_X1C_PRINT_VOLUME: AiPrintVolumeMm = {
  x: 256,
  y: 256,
  z: 256,
}

const DEFAULT_LAMP_SYSTEM_PROMPT = `Du bist ein präziser 3D-Designer für Lampen und Leuchten bei DripForge.
Erstelle druckbare Geometrie für FDM (PLA/PETG). Halte feste Aussparungen exakt ein.
Keine schwebenden Teile ohne Stützstruktur-Hinweis. Kabelführungen müssen durchgängig sein.`

function defaultCutout(
  id: string,
  label: string,
  partial: Partial<AiCutoutSpec>
): AiCutoutSpec {
  return {
    id,
    label,
    diameterMm: partial.diameterMm ?? null,
    widthMm: partial.widthMm ?? null,
    heightMm: partial.heightMm ?? null,
    depthMm: partial.depthMm ?? null,
    notes: partial.notes ?? "",
  }
}

export function buildDefaultAiCategory(
  id: AiProductCategoryId = "lampen"
): AiCategoryConfig {
  if (id === "lampen") {
    return {
      id: "lampen",
      name: "Lampen",
      enabled: true,
      systemPrompt: DEFAULT_LAMP_SYSTEM_PROMPT,
      cutouts: [
        defaultCutout("e27-socket", "Gewindebohrung / Fassung (E27)", {
          diameterMm: 25,
          depthMm: 35,
          notes: "Zentrale Aussparung von unten, passend für E27-Fassung.",
        }),
        defaultCutout("cable-port", "Kabelführung", {
          diameterMm: 8,
          depthMm: 12,
          notes: "Rückseite unten, senkrecht zur Standfläche.",
        }),
      ],
      maxPrintSizeMm: { ...BAMBU_X1C_PRINT_VOLUME },
    }
  }
  return {
    id,
    name: id,
    enabled: true,
    systemPrompt: DEFAULT_LAMP_SYSTEM_PROMPT,
    cutouts: [],
    maxPrintSizeMm: { ...BAMBU_X1C_PRINT_VOLUME },
  }
}

export function buildDefaultAiSettings(): AiSettingsDocument {
  return {
    categories: AI_PRODUCT_CATEGORIES.map((id) => buildDefaultAiCategory(id)),
    updatedAt: new Date().toISOString(),
  }
}

function clampMm(value: unknown, fallback: number, max = 500): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(1, Math.round(n * 10) / 10))
}

function hasMmValue(value: unknown): value is number {
  return value != null && value !== "" && Number.isFinite(Number(value))
}

function normalizeCutout(
  input: Partial<AiCutoutSpec> | undefined,
  fallback: AiCutoutSpec
): AiCutoutSpec {
  return {
    id: input?.id?.trim() || fallback.id,
    label: input?.label?.trim() || fallback.label,
    diameterMm: hasMmValue(input?.diameterMm)
      ? clampMm(input.diameterMm, fallback.diameterMm ?? 0)
      : null,
    widthMm: hasMmValue(input?.widthMm)
      ? clampMm(input.widthMm, fallback.widthMm ?? 0)
      : null,
    heightMm: hasMmValue(input?.heightMm)
      ? clampMm(input.heightMm, fallback.heightMm ?? 0)
      : null,
    depthMm: hasMmValue(input?.depthMm)
      ? clampMm(input.depthMm, fallback.depthMm ?? 0)
      : null,
    notes: String(input?.notes ?? fallback.notes).slice(0, 500),
  }
}

export function normalizeAiCategoryConfig(
  input: Partial<AiCategoryConfig> | undefined,
  id: AiProductCategoryId
): AiCategoryConfig {
  const fallback = buildDefaultAiCategory(id)
  const cutoutsSource = Array.isArray(input?.cutouts) ? input.cutouts : fallback.cutouts

  return {
    id,
    name: input?.name?.trim() || fallback.name,
    enabled: input?.enabled !== false,
    systemPrompt: input?.systemPrompt?.trim() || fallback.systemPrompt,
    cutouts: cutoutsSource.map((cutout, index) =>
      normalizeCutout(cutout, fallback.cutouts[index] ?? fallback.cutouts[0])
    ),
    maxPrintSizeMm: {
      x: clampMm(input?.maxPrintSizeMm?.x, fallback.maxPrintSizeMm.x),
      y: clampMm(input?.maxPrintSizeMm?.y, fallback.maxPrintSizeMm.y),
      z: clampMm(input?.maxPrintSizeMm?.z, fallback.maxPrintSizeMm.z),
    },
  }
}

export function mergeAiSettings(
  stored: Partial<AiSettingsDocument> | null | undefined
): AiSettingsDocument {
  const defaults = buildDefaultAiSettings()
  const categories = AI_PRODUCT_CATEGORIES.map((id) => {
    const fromStored = stored?.categories?.find((c) => c.id === id)
    return normalizeAiCategoryConfig(fromStored, id)
  })
  return {
    categories,
    updatedAt: stored?.updatedAt ?? defaults.updatedAt,
  }
}

export function sanitizeAiSettingsInput(
  input: Partial<AiSettingsDocument>
): AiSettingsDocument {
  return {
    ...mergeAiSettings(input),
    updatedAt: new Date().toISOString(),
  }
}

export function getAiCategoryById(
  settings: AiSettingsDocument,
  categoryId: string
): AiCategoryConfig | null {
  const normalized = AI_PRODUCT_CATEGORIES.includes(categoryId as AiProductCategoryId)
    ? (categoryId as AiProductCategoryId)
    : null
  if (!normalized) return null
  return settings.categories.find((c) => c.id === normalized) ?? null
}
