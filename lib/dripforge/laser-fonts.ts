import type { CSSProperties } from "react"

export type LaserFontId =
  | "kalligrafie"
  | "modern"
  | "klassisch"
  | "rustikal"
  | "futuristisch"
  | "vintage"
  | "minimalistisch"
  | "schwungvoll"

export const DEFAULT_LASER_FONT_ID: LaserFontId = "modern"

export type LaserFontOption = {
  id: LaserFontId
  label: string
  description: string
  fontFamily: string
  featured?: boolean
  tilePreviewStyle?: CSSProperties
  canvasStyle?: CSSProperties
}

/** Exklusive Top-8 mit Webfont-Variablen (layout.tsx) und System-Fallbacks */
export const LASER_FONT_OPTIONS: LaserFontOption[] = [
  {
    id: "modern",
    label: "Standard (Klar)",
    description: "Inter · moderne Blockschrift, gut lesbar",
    fontFamily: "var(--laser-font-inter), 'Inter', Arial, sans-serif",
    tilePreviewStyle: { fontWeight: 600, letterSpacing: "-0.02em" },
    canvasStyle: { fontWeight: 600, letterSpacing: "-0.01em" },
  },
  {
    id: "minimalistisch",
    label: "Minimalistisch (Light)",
    description: "Helvetica Neue · reduziert",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    tilePreviewStyle: { fontWeight: 300, letterSpacing: "0.05em" },
    canvasStyle: { fontWeight: 300, letterSpacing: "0.04em" },
  },
  {
    id: "klassisch",
    label: "Klassisch (Serif)",
    description: "Playfair Display · edel",
    fontFamily: "var(--laser-font-playfair), 'Playfair Display', Georgia, serif",
    tilePreviewStyle: { fontWeight: 500 },
  },
  {
    id: "rustikal",
    label: "Rustikal (Bold)",
    description: "Montserrat · kraeftig",
    fontFamily: "var(--laser-font-montserrat), 'Montserrat', Impact, sans-serif",
    tilePreviewStyle: {
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      fontSize: "1.35rem",
    },
    canvasStyle: {
      fontWeight: 900,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    },
  },
  {
    id: "futuristisch",
    label: "Futuristisch (Monospace)",
    description: "JetBrains Mono · präzise",
    fontFamily:
      "var(--laser-font-jetbrains), 'JetBrains Mono', 'Courier New', monospace",
    tilePreviewStyle: { fontWeight: 500, fontSize: "1.25rem" },
  },
  {
    id: "vintage",
    label: "Vintage (Retro)",
    description: "Rockwell · nostalgisch",
    fontFamily: "'Rockwell', 'Rockwell Extra Bold', Georgia, serif",
    tilePreviewStyle: { fontWeight: 700 },
  },
  {
    id: "schwungvoll",
    label: "Schwungvoll (Casual)",
    description: "Caveat · locker & freundlich",
    fontFamily: "var(--laser-font-caveat), 'Caveat', 'Comic Sans MS', cursive",
    tilePreviewStyle: { fontSize: "1.65rem", lineHeight: 1.1 },
    canvasStyle: { fontSize: "clamp(1rem, 4.2vw, 1.55rem)", lineHeight: 1.2 },
  },
  {
    id: "kalligrafie",
    label: "Kalligrafie (Edwardian Script)",
    description: "Edwardian Script ITC · dekorativ",
    featured: true,
    fontFamily:
      "'Edwardian Script ITC', var(--laser-font-great-vibes), 'Brush Script MT', cursive",
    tilePreviewStyle: { fontSize: "2rem", lineHeight: 1.05 },
    canvasStyle: {
      fontSize: "clamp(1.05rem, 4.8vw, 1.85rem)",
      lineHeight: 1.15,
    },
  },
]

export function getLaserFontOption(fontId: LaserFontId): LaserFontOption {
  return (
    LASER_FONT_OPTIONS.find((f) => f.id === fontId) ?? LASER_FONT_OPTIONS[0]
  )
}

/** CSS font-family für Canvas und Vorschau */
export function getLaserFontFamily(fontId: LaserFontId): string {
  return getLaserFontOption(fontId).fontFamily
}

/**
 * Canvas/2D-Context kann CSS-Variablen (`var(--…)`) nicht auflösen.
 * Liefert die vom Browser berechnete font-family (inkl. next/font-Hash)
 * bzw. konkrete Fallback-Namen.
 */
export function getLaserFontFamilyForCanvas(fontId: LaserFontId): string {
  const opt = getLaserFontOption(fontId)
  if (typeof document !== "undefined" && document.body) {
    try {
      const el = document.createElement("span")
      el.setAttribute("aria-hidden", "true")
      el.style.cssText =
        "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;font-size:16px;"
      el.style.fontFamily = opt.fontFamily
      document.body.appendChild(el)
      const computed = getComputedStyle(el).fontFamily
      document.body.removeChild(el)
      if (
        computed &&
        computed.trim().length > 0 &&
        computed !== "serif" &&
        computed !== "sans-serif" &&
        computed !== "monospace" &&
        computed !== "cursive"
      ) {
        return computed
      }
    } catch {
      /* Fallbacks unten */
    }
  }

  switch (fontId) {
    case "modern":
      return "'Inter', Arial, sans-serif"
    case "minimalistisch":
      return "'Helvetica Neue', Helvetica, Arial, sans-serif"
    case "klassisch":
      return "'Playfair Display', Georgia, serif"
    case "rustikal":
      return "'Montserrat', Impact, sans-serif"
    case "futuristisch":
      return "'JetBrains Mono', 'Courier New', monospace"
    case "vintage":
      return "'Rockwell', 'Rockwell Extra Bold', Georgia, serif"
    case "schwungvoll":
      return "'Caveat', 'Comic Sans MS', cursive"
    case "kalligrafie":
      return "'Edwardian Script ITC', 'Great Vibes', 'Brush Script MT', cursive"
    default:
      return "'Inter', Arial, sans-serif"
  }
}

/** Basis-Fontgrösse (px) in der Live-Vorschau bei ~420px Preview-Breite. */
export function getLaserPreviewBaseFontPx(fontId: LaserFontId): number {
  switch (fontId) {
    case "schwungvoll":
      return 24
    case "kalligrafie":
      return 28
    case "rustikal":
      return 22
    case "futuristisch":
      return 20
    default:
      return 20
  }
}

/** Wartet auf Webfonts und lädt Laser-Fonts explizit. */
export async function ensureLaserFontsReady(
  fontIds?: LaserFontId[]
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return
  try {
    await document.fonts.ready
  } catch {
    /* ignore */
  }
  const ids = fontIds?.length
    ? fontIds
    : LASER_FONT_OPTIONS.map((f) => f.id)

  /** Konkrete Familien zum expliziten document.fonts.load (ohne Fallbacks). */
  const primaryFamilies = (id: LaserFontId): string[] => {
    // Zuerst berechnete Familie (next/font-Hash), dann lesbare Namen
    const resolved = getLaserFontFamilyForCanvas(id)
    const quoted =
      resolved.match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) ??
      resolved.match(/'([^']+)'/g)?.map((s) => s.slice(1, -1)) ??
      []
    const bare = resolved
      .split(",")
      .map((p) => p.trim().replace(/^["']|["']$/g, ""))
      .filter((p) => p && !/^(serif|sans-serif|monospace|cursive|fantasy)$/i.test(p))
    const extras: string[] = (() => {
      switch (id) {
        case "modern":
          return ["Inter"]
        case "klassisch":
          return ["Playfair Display"]
        case "rustikal":
          return ["Montserrat"]
        case "futuristisch":
          return ["JetBrains Mono"]
        case "schwungvoll":
          return ["Caveat"]
        case "kalligrafie":
          return ["Great Vibes", "Edwardian Script ITC"]
        default:
          return []
      }
    })()
    return Array.from(new Set([...quoted, ...bare, ...extras]))
  }

  await Promise.all(
    ids.flatMap((id) => {
      const size = getLaserPreviewBaseFontPx(id)
      const families = primaryFamilies(id)
      return families.flatMap((family) => [
        document.fonts
          .load(`600 ${size}px "${family}"`)
          .catch(() => document.fonts.load(`${size}px "${family}"`).catch(() => undefined)),
        document.fonts
          .load(`400 ${Math.round(size * 1.5)}px "${family}"`)
          .catch(() => undefined),
      ])
    })
  )
  try {
    await document.fonts.ready
  } catch {
    /* ignore */
  }
}

export function getLaserFontStyle(
  fontId: LaserFontId,
  context: "tile" | "canvas" = "canvas"
): CSSProperties {
  const opt = getLaserFontOption(fontId)
  const extras = context === "tile" ? opt.tilePreviewStyle : opt.canvasStyle
  return {
    fontFamily: opt.fontFamily,
    ...extras,
  }
}

const DROPDOWN_FONT_SIZE = "0.875rem"
const INPUT_FONT_SIZE = "0.9375rem"

/** Kompakte Schrift-Vorschau im Dropdown (ohne grosse tile-Grössen) */
export function getLaserFontDropdownStyle(fontId: LaserFontId): CSSProperties {
  const opt = getLaserFontOption(fontId)
  const { fontSize: _omitSize, ...typography } = opt.tilePreviewStyle ?? {}
  void _omitSize
  return {
    fontFamily: opt.fontFamily,
    fontSize: DROPDOWN_FONT_SIZE,
    lineHeight: 1.35,
    ...typography,
  }
}

/** Lesbare Grösse für Gravur-Textarea */
export function getLaserFontInputStyle(fontId: LaserFontId): CSSProperties {
  const opt = getLaserFontOption(fontId)
  const { fontSize: _omitSize, ...typography } = opt.canvasStyle ?? {}
  void _omitSize
  return {
    fontFamily: opt.fontFamily,
    fontSize: INPUT_FONT_SIZE,
    lineHeight: 1.45,
    ...typography,
  }
}
