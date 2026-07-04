import { Font } from "@react-pdf/renderer"
import type { DocumentFontFamily } from "@/lib/documents/document-template-types"

let fontsRegistered = false

export function ensureDocumentPdfFonts(): void {
  if (fontsRegistered) return
  fontsRegistered = true

  Font.register({
    family: "Inter",
    fonts: [
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

export function resolvePdfFontFamily(family: DocumentFontFamily): string {
  if (family === "helvetica" || family === "arial") return "Helvetica"
  if (family === "inter") return "Inter"
  if (family === "roboto") return "Roboto"
  return "Helvetica"
}

export function pdfBoldFontFamily(family: DocumentFontFamily): string {
  if (family === "helvetica" || family === "arial") return "Helvetica-Bold"
  return resolvePdfFontFamily(family)
}

export function pdfBoldStyle(family: DocumentFontFamily): {
  fontFamily: string
  fontWeight?: number
} {
  if (family === "helvetica" || family === "arial") {
    return { fontFamily: "Helvetica-Bold" }
  }
  return { fontFamily: resolvePdfFontFamily(family), fontWeight: 700 }
}
