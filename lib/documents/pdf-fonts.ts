import { Font } from "@react-pdf/renderer"
import type { DocumentFontFamily } from "@/lib/documents/document-template-types"

let fontsRegistered = false

/**
 * Registriert Unicode-fähige Fonts (latin-ext inkl. äöüÄÖÜß).
 * Helvetica/Arial von react-pdf unterstützen Umlaute unzuverlässig.
 */
export function ensureDocumentPdfFonts(): void {
  if (fontsRegistered) return
  fontsRegistered = true

  Font.register({
    family: "Inter",
    fonts: [
      {
        src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-ext-400-normal.woff",
        fontWeight: 400,
      },
      {
        src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-ext-700-normal.woff",
        fontWeight: 700,
      },
      {
        src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-400-normal.woff",
        fontWeight: 400,
      },
      {
        src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-700-normal.woff",
        fontWeight: 700,
      },
    ],
  })

  Font.register({
    family: "Roboto",
    fonts: [
      {
        src: "https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-ext-400-normal.woff",
        fontWeight: 400,
      },
      {
        src: "https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-ext-700-normal.woff",
        fontWeight: 700,
      },
      {
        src: "https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-400-normal.woff",
        fontWeight: 400,
      },
      {
        src: "https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-700-normal.woff",
        fontWeight: 700,
      },
    ],
  })
}

/**
 * PDF-Schriftfamilie — Helvetica/Arial werden auf Inter gemappt,
 * damit Umlaute (äöü) zuverlässig gerendert werden.
 */
export function resolvePdfFontFamily(family: DocumentFontFamily): string {
  if (family === "roboto") return "Roboto"
  // helvetica | arial | inter → Inter (UTF-8 / latin-ext)
  return "Inter"
}

export function pdfBoldFontFamily(family: DocumentFontFamily): string {
  return resolvePdfFontFamily(family)
}

export function pdfBoldStyle(family: DocumentFontFamily): {
  fontFamily: string
  fontWeight?: number
} {
  return { fontFamily: resolvePdfFontFamily(family), fontWeight: 700 }
}
