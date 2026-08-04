/** Normalisiert die globale E-Mail-Signatur (Freitext, begrenzt). */
export function normalizeEmailSignature(input: unknown): string {
  if (typeof input !== "string") return ""
  return input.slice(0, 3000)
}

/** Standard-Signatur, falls keine gesetzt ist. */
export const DEFAULT_EMAIL_SIGNATURE = ""
