import type { BelegNumberingSettings } from "@/lib/admin/types"

function cleanPrefix(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8)
  if (!cleaned) return undefined
  // Legacy OF → OFF
  if (cleaned === "OF") return "OFF"
  return cleaned
}

export function normalizeBelegNumbering(
  input: unknown
): BelegNumberingSettings | undefined {
  if (!input || typeof input !== "object") return undefined
  const raw = input as Record<string, unknown>
  const offertePrefix = cleanPrefix(raw.offertePrefix)
  const rechnungPrefix = cleanPrefix(raw.rechnungPrefix)
  const lieferscheinPrefix = cleanPrefix(raw.lieferscheinPrefix)
  const yearFormat =
    typeof raw.yearFormat === "boolean" ? raw.yearFormat : undefined

  if (
    offertePrefix === undefined &&
    rechnungPrefix === undefined &&
    lieferscheinPrefix === undefined &&
    yearFormat === undefined
  ) {
    return undefined
  }

  return {
    ...(offertePrefix !== undefined ? { offertePrefix } : {}),
    ...(rechnungPrefix !== undefined ? { rechnungPrefix } : {}),
    ...(lieferscheinPrefix !== undefined ? { lieferscheinPrefix } : {}),
    ...(yearFormat !== undefined ? { yearFormat } : {}),
  }
}
