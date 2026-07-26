/**
 * Beleg-MwSt-Optionen — gekoppelt an die Umsatzsteuer-Codes der Buchhaltung
 * (siehe lib/accounting/tax-code-seed.ts: U00, UN81, UR26).
 *
 * Aliasse (MWST_0 / EXEMPT usw.) werden beim Einlesen akzeptiert und auf den
 * kanonischen Buchhaltungs-Code normalisiert.
 */

export type BelegVatOption = {
  /** Kanonischer Steuercode wie in der Buchhaltung (Journal). */
  taxCode: string
  /** Semantischer Schlüssel (EXEMPT / NORMAL / REDUCED). */
  systemKey: "EXEMPT" | "NORMAL" | "REDUCED"
  /** Zusätzliche Eingabe-Aliasse. */
  aliases: string[]
  /** Steuersatz als Dezimalzahl (0.081 = 8.1 %). */
  taxRate: number
  /** Steuersatz in Prozent für Anzeige / Legacy-Feld. */
  taxRatePercent: number
  label: string
}

export const BELEG_VAT_OPTIONS: readonly BelegVatOption[] = [
  {
    taxCode: "U00",
    systemKey: "EXEMPT",
    aliases: ["MWST_0", "EXEMPT", "USt00", "0"],
    taxRate: 0,
    taxRatePercent: 0,
    label: "0% (Befreit / Keiner)",
  },
  {
    taxCode: "UN81",
    systemKey: "NORMAL",
    aliases: ["MWST_81", "NORMAL", "USt81", "8.1"],
    taxRate: 0.081,
    taxRatePercent: 8.1,
    label: "8.1% (Normalsatz)",
  },
  {
    taxCode: "UR26",
    systemKey: "REDUCED",
    aliases: ["MWST_26", "REDUCED", "USt26", "2.6"],
    taxRate: 0.026,
    taxRatePercent: 2.6,
    label: "2.6% (Reduziert)",
  },
] as const

/** Standard für neue Beleg-Positionen. */
export const DEFAULT_BELEG_VAT = BELEG_VAT_OPTIONS[0]

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
}

export function findBelegVatOptionByCode(
  taxCode: string | null | undefined
): BelegVatOption | null {
  const key = normalizeKey(taxCode)
  if (!key) return null
  return (
    BELEG_VAT_OPTIONS.find(
      (opt) =>
        opt.taxCode === key ||
        opt.systemKey === key ||
        opt.aliases.some((alias) => normalizeKey(alias) === key)
    ) ?? null
  )
}

export function findBelegVatOptionByRate(
  taxRateOrPercent: number | null | undefined
): BelegVatOption | null {
  const raw = Number(taxRateOrPercent)
  if (!Number.isFinite(raw) || raw < 0) return null

  // Akzeptiert sowohl Dezimal (0.081) als auch Prozent (8.1)
  const asDecimal = raw > 1 ? raw / 100 : raw
  const asPercent = raw > 1 ? raw : raw * 100

  for (const opt of BELEG_VAT_OPTIONS) {
    if (Math.abs(opt.taxRate - asDecimal) < 0.002) return opt
    if (Math.abs(opt.taxRatePercent - asPercent) < 0.05) return opt
  }
  return null
}

/**
 * Löst taxCode + taxRate + taxRatePercent aus Rohdaten auf.
 * Priorität: taxCode → taxRate → taxRatePercent → Default (0 % / U00).
 */
export function resolveBelegVatFields(raw: {
  taxCode?: string | null
  taxRate?: number | null
  taxRatePercent?: number | null
}): Pick<BelegVatOption, "taxCode" | "taxRate" | "taxRatePercent"> {
  const byCode = findBelegVatOptionByCode(raw.taxCode)
  if (byCode) {
    return {
      taxCode: byCode.taxCode,
      taxRate: byCode.taxRate,
      taxRatePercent: byCode.taxRatePercent,
    }
  }

  const byRate =
    findBelegVatOptionByRate(raw.taxRate) ??
    findBelegVatOptionByRate(raw.taxRatePercent)

  if (byRate) {
    return {
      taxCode: byRate.taxCode,
      taxRate: byRate.taxRate,
      taxRatePercent: byRate.taxRatePercent,
    }
  }

  return {
    taxCode: DEFAULT_BELEG_VAT.taxCode,
    taxRate: DEFAULT_BELEG_VAT.taxRate,
    taxRatePercent: DEFAULT_BELEG_VAT.taxRatePercent,
  }
}
