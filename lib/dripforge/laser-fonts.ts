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
    description: "JetBrains Mono · praezise",
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

/** CSS font-family fuer Canvas und Vorschau */
export function getLaserFontFamily(fontId: LaserFontId): string {
  return getLaserFontOption(fontId).fontFamily
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

/** Kompakte Schrift-Vorschau im Dropdown (ohne grosse tile-Groessen) */
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

/** Lesbare Groesse fuer Gravur-Textarea */
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
