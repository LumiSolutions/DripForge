/** Kontenart aus dem Schweizer KMU-Kontenplan (chart-of-accounts.xlsx). */
export type AccountKind =
  | "Gruppe"
  | "Aktiv"
  | "Passiv"
  | "Aufwand"
  | "Ertrag"
  | "Komplett"
  | (string & {})

/** Buchhaltungskonto (Schweizer KMU-Kontenplan). */
export type Account = {
  /** Eindeutige Kontonummer, z. B. "100011". */
  number: string
  /** Kontobezeichnung, z. B. "Kasse". */
  name: string
  /** Übergeordnete Kontonummer / Gruppe (leer bei Wurzelgruppen). */
  group: string | null
  /** Kontoart: Gruppe, Aktiv, Passiv, Aufwand, Ertrag, … */
  type: AccountKind
  /** Optionales Systemkonto aus der Import-Datei. */
  systemCode?: string
  /** Optionaler Steuertyp aus der Import-Datei. */
  taxType?: string
  /** Manuelle Bearbeitung erlaubt (Standard: true). */
  isEditable: boolean
  createdAt: string
  updatedAt: string
}

export type AccountCosmosDoc = Account & {
  id: string
  docType: typeof CHART_ACCOUNT_DOC_TYPE
}

export const CHART_ACCOUNT_DOC_TYPE = "chart-account" as const

export const DEFAULT_ACCOUNT_IS_EDITABLE = true

export function chartAccountCosmosId(number: string): string {
  const normalized = normalizeAccountNumber(number)
  return `${CHART_ACCOUNT_DOC_TYPE}:${normalized}`
}

function trimOptional(value: unknown): string | undefined {
  if (value == null) return undefined
  const trimmed = String(value).trim()
  return trimmed || undefined
}

export function normalizeAccountNumber(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

export function normalizeAccountGroup(value: unknown): string | null {
  const trimmed = normalizeAccountNumber(value)
  return trimmed || null
}

export function normalizeAccount(input: Partial<Account> & { number: string }): Account {
  const now = new Date().toISOString()
  return {
    number: normalizeAccountNumber(input.number),
    name: String(input.name ?? "").trim(),
    group: normalizeAccountGroup(input.group),
    type: String(input.type ?? "").trim() as AccountKind,
    systemCode: trimOptional(input.systemCode),
    taxType: trimOptional(input.taxType),
    isEditable: input.isEditable ?? DEFAULT_ACCOUNT_IS_EDITABLE,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }
}

export function toAccountCosmosDoc(account: Account): AccountCosmosDoc {
  return {
    ...account,
    id: chartAccountCosmosId(account.number),
    docType: CHART_ACCOUNT_DOC_TYPE,
  }
}
