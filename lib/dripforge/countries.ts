/** Standard-Länderliste für Checkout / Profil / Admin (Schweiz-fokussiert). */

export type CountryOption = {
  code: string
  label: string
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "CH", label: "Schweiz" },
  { code: "LI", label: "Liechtenstein" },
  { code: "DE", label: "Deutschland" },
  { code: "AT", label: "Österreich" },
  { code: "FR", label: "Frankreich" },
  { code: "IT", label: "Italien" },
  { code: "BE", label: "Belgien" },
  { code: "NL", label: "Niederlande" },
  { code: "LU", label: "Luxemburg" },
  { code: "ES", label: "Spanien" },
  { code: "PT", label: "Portugal" },
  { code: "PL", label: "Polen" },
  { code: "CZ", label: "Tschechien" },
  { code: "DK", label: "Dänemark" },
  { code: "SE", label: "Schweden" },
  { code: "NO", label: "Norwegen" },
  { code: "GB", label: "Vereinigtes Königreich" },
  { code: "US", label: "USA" },
  { code: "OTHER", label: "Anderes Land" },
]

export const DEFAULT_COUNTRY_LABEL = "Schweiz"

/** Normalisiert freie Texte / Codes auf Label aus COUNTRY_OPTIONS. */
export function normalizeCountryLabel(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim()
  if (!value) return DEFAULT_COUNTRY_LABEL
  const lower = value.toLowerCase()
  const byCode = COUNTRY_OPTIONS.find(
    (o) => o.code.toLowerCase() === lower
  )
  if (byCode) return byCode.label
  const byLabel = COUNTRY_OPTIONS.find(
    (o) => o.label.toLowerCase() === lower
  )
  if (byLabel) return byLabel.label
  // Häufige Aliase
  if (["ch", "switzerland", "suisse", "svizzera"].includes(lower)) {
    return "Schweiz"
  }
  if (["li", "lichtenstein", "liechtenstein"].includes(lower)) {
    return "Liechtenstein"
  }
  if (["de", "germany", "deutschland"].includes(lower)) return "Deutschland"
  if (["at", "austria", "österreich", "oesterreich"].includes(lower)) {
    return "Österreich"
  }
  return value
}

export function isKnownCountryLabel(label: string): boolean {
  const normalized = normalizeCountryLabel(label)
  return COUNTRY_OPTIONS.some((o) => o.label === normalized)
}
