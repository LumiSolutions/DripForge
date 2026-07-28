/**
 * Entfernt Soft-Hyphens und unsichtbare Steuerzeichen, die in PDF-Fonts
 * als kaputte Glyphen (□ / ) gerendert werden.
 */
const INVISIBLE_OR_SOFT_CHARS =
  /[\u00AD\u200B\u200C\u200D\u2060\uFEFF\u180E]/g

export function sanitizePdfText(input: unknown): string {
  if (input == null) return ""
  return String(input)
    .replace(/&shy;/gi, "")
    .replace(/&#173;/gi, "")
    .replace(/&#x0*ad;/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&#x0*a0;/gi, " ")
    .replace(INVISIBLE_OR_SOFT_CHARS, "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2028\u2029]/g, "\n")
}

/** Sanitized Join von Teilen (Namezeilen, Adressen, …). */
export function sanitizePdfParts(
  parts: unknown[],
  separator = " "
): string {
  return parts
    .map((part) => sanitizePdfText(part).trim())
    .filter(Boolean)
    .join(separator)
}
