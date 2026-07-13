import type { Account } from "@/lib/accounting/account-types"
import { normalizeAccountNumber } from "@/lib/accounting/account-types"
import type { JournalEntry, JournalLine } from "@/lib/accounting/journal-types"

function roundChf(value: number): number {
  return Math.round(value * 100) / 100
}

function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to
}

function accountClass(number: string): number {
  const digit = Number(number.charAt(0))
  return Number.isFinite(digit) ? digit : 0
}

function accountName(accounts: Account[], number: string): string {
  const match = accounts.find(
    (item) => normalizeAccountNumber(item.number) === normalizeAccountNumber(number)
  )
  return match ? `${match.number} ${match.name}` : number
}

function counterpartAccounts(
  entry: JournalEntry,
  line: JournalLine
): string[] {
  return entry.lines
    .filter(
      (other) =>
        other.accountNumber !== line.accountNumber || other.type !== line.type
    )
    .map((other) => other.accountNumber)
    .filter((value, index, list) => list.indexOf(value) === index)
}

export type LedgerRow = {
  entryId: string
  date: string
  belegNummer: string
  description: string
  gegenkonto: string
  soll: number
  haben: number
  saldo: number
}

export function buildLedgerRows(
  entries: JournalEntry[],
  accounts: Account[],
  from: string,
  to: string,
  accountNumber?: string
): LedgerRow[] {
  const target = accountNumber?.trim()
    ? normalizeAccountNumber(accountNumber)
    : null
  const rows: LedgerRow[] = []
  let running = 0

  const sorted = [...entries]
    .filter((entry) => inRange(entry.date, from, to))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.belegNummer.localeCompare(b.belegNummer)
    })

  for (const entry of sorted) {
    for (const line of entry.lines) {
      const number = normalizeAccountNumber(line.accountNumber)
      if (target && number !== target) continue

      const soll = line.type === "SOLL" ? roundChf(line.amount) : 0
      const haben = line.type === "HABEN" ? roundChf(line.amount) : 0
      running = roundChf(running + soll - haben)
      const gegenkonten = counterpartAccounts(entry, line)
      rows.push({
        entryId: entry.id,
        date: entry.date,
        belegNummer: entry.belegNummer,
        description: entry.description,
        gegenkonto: gegenkonten.map((nr) => accountName(accounts, nr)).join(", "),
        soll,
        haben,
        saldo: running,
      })
    }
  }

  return rows
}

export type JournalReportRow = {
  entryId: string
  belegNummer: string
  date: string
  sollKonto: string
  habenKonto: string
  description: string
  taxCode: string
  amount: number
}

export function buildJournalReportRows(
  entries: JournalEntry[],
  accounts: Account[],
  from: string,
  to: string
): JournalReportRow[] {
  const rows: JournalReportRow[] = []

  for (const entry of [...entries]
    .filter((item) => inRange(item.date, from, to))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))) {
    if (entry.bookingRows?.length) {
      for (const bookingRow of entry.bookingRows) {
        rows.push({
          entryId: entry.id,
          belegNummer: entry.belegNummer,
          date: entry.date,
          sollKonto: accountName(accounts, bookingRow.debitAccountNumber),
          habenKonto: accountName(accounts, bookingRow.creditAccountNumber),
          description: bookingRow.description || entry.description,
          taxCode: bookingRow.taxCode || "—",
          amount: roundChf(bookingRow.amount),
        })
      }
      continue
    }

    const sollLines = entry.lines.filter((line) => line.type === "SOLL")
    const habenLines = entry.lines.filter((line) => line.type === "HABEN")
    const pairs = Math.max(sollLines.length, habenLines.length, 1)
    for (let i = 0; i < pairs; i++) {
      const soll = sollLines[i] ?? sollLines[0]
      const haben = habenLines[i] ?? habenLines[0]
      if (!soll || !haben) continue
      rows.push({
        entryId: entry.id,
        belegNummer: entry.belegNummer,
        date: entry.date,
        sollKonto: accountName(accounts, soll.accountNumber),
        habenKonto: accountName(accounts, haben.accountNumber),
        description: entry.description,
        taxCode: soll.taxCode || haben.taxCode || "—",
        amount: roundChf(soll.amount),
      })
    }
  }

  return rows
}

export type ReportAccountDetail = {
  number: string
  name: string
  amount: number
}

export type IncomeStatementLine = {
  id: string
  label: string
  amount: number
  level: 0 | 1 | 2
  emphasis?: boolean
  expandable?: boolean
  accounts?: ReportAccountDetail[]
}

export type BalanceSheetLine = {
  id: string
  label: string
  amount: number
  level: 0 | 1 | 2
  section: "aktiven" | "passiven"
  emphasis?: boolean
  expandable?: boolean
  accounts?: ReportAccountDetail[]
}

function netOnAccounts(
  entries: JournalEntry[],
  from: string,
  to: string,
  classDigits: number[],
  mode: "credit" | "debit"
): number {
  let total = 0
  for (const entry of entries) {
    if (!inRange(entry.date, from, to)) continue
    for (const line of entry.lines) {
      const cls = accountClass(line.accountNumber)
      if (!classDigits.includes(cls)) continue
      const amount = roundChf(line.amount)
      if (mode === "credit") {
        total += line.type === "HABEN" ? amount : -amount
      } else {
        total += line.type === "SOLL" ? amount : -amount
      }
    }
  }
  return roundChf(total)
}

function balanceForPrefix(
  entries: JournalEntry[],
  to: string,
  prefixes: string[],
  side: "aktiv" | "passiv"
): number {
  let total = 0
  for (const entry of entries) {
    if (entry.date > to) continue
    for (const line of entry.lines) {
      const number = normalizeAccountNumber(line.accountNumber)
      if (!prefixes.some((prefix) => number.startsWith(prefix))) continue
      const amount = roundChf(line.amount)
      if (side === "aktiv") {
        total += line.type === "SOLL" ? amount : -amount
      } else {
        total += line.type === "HABEN" ? amount : -amount
      }
    }
  }
  return roundChf(total)
}

function isBookableAccount(account: Account): boolean {
  return account.type !== "Gruppe" && account.isActive !== false
}

function matchPrefixes(number: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => number.startsWith(prefix))
}

/** Salden je Konto für Erfolgsrechnung (Haben − Soll bzw. Soll − Haben). */
function collectIncomeAccountDetails(
  entries: JournalEntry[],
  accounts: Account[],
  from: string,
  to: string,
  classDigits: number[],
  mode: "credit" | "debit"
): ReportAccountDetail[] {
  const map = new Map<string, number>()

  for (const entry of entries) {
    if (!inRange(entry.date, from, to)) continue
    for (const line of entry.lines) {
      const number = normalizeAccountNumber(line.accountNumber)
      if (!classDigits.includes(accountClass(number))) continue
      const amount = roundChf(line.amount)
      const signed =
        mode === "credit"
          ? line.type === "HABEN"
            ? amount
            : -amount
          : line.type === "SOLL"
            ? amount
            : -amount
      map.set(number, roundChf((map.get(number) ?? 0) + signed))
    }
  }

  const chartMatches = accounts.filter(
    (account) =>
      isBookableAccount(account) &&
      classDigits.includes(accountClass(account.number))
  )

  const details: ReportAccountDetail[] = []
  const seen = new Set<string>()

  for (const [number, amount] of map.entries()) {
    const account = accounts.find(
      (item) => normalizeAccountNumber(item.number) === number
    )
    details.push({
      number,
      name: account?.name ?? number,
      amount: mode === "debit" ? -amount : amount,
    })
    seen.add(number)
  }

  for (const account of chartMatches) {
    const number = normalizeAccountNumber(account.number)
    if (seen.has(number)) continue
    details.push({ number, name: account.name, amount: 0 })
  }

  return details.sort((a, b) => a.number.localeCompare(b.number, "de-CH"))
}

function collectBalanceAccountDetails(
  entries: JournalEntry[],
  accounts: Account[],
  to: string,
  prefixes: string[],
  side: "aktiv" | "passiv"
): ReportAccountDetail[] {
  const map = new Map<string, number>()

  for (const entry of entries) {
    if (entry.date > to) continue
    for (const line of entry.lines) {
      const number = normalizeAccountNumber(line.accountNumber)
      if (!matchPrefixes(number, prefixes)) continue
      const amount = roundChf(line.amount)
      const signed =
        side === "aktiv"
          ? line.type === "SOLL"
            ? amount
            : -amount
          : line.type === "HABEN"
            ? amount
            : -amount
      map.set(number, roundChf((map.get(number) ?? 0) + signed))
    }
  }

  const chartMatches = accounts.filter(
    (account) =>
      isBookableAccount(account) &&
      matchPrefixes(normalizeAccountNumber(account.number), prefixes)
  )

  const details: ReportAccountDetail[] = []
  const seen = new Set<string>()

  for (const [number, amount] of map.entries()) {
    const account = accounts.find(
      (item) => normalizeAccountNumber(item.number) === number
    )
    details.push({
      number,
      name: account?.name ?? number,
      amount,
    })
    seen.add(number)
  }

  for (const account of chartMatches) {
    const number = normalizeAccountNumber(account.number)
    if (seen.has(number)) continue
    details.push({ number, name: account.name, amount: 0 })
  }

  return details
    .filter((item) => Math.abs(item.amount) > 0.004 || chartMatches.length > 0)
    .sort((a, b) => a.number.localeCompare(b.number, "de-CH"))
}

export function buildIncomeStatement(
  entries: JournalEntry[],
  from: string,
  to: string,
  accounts: Account[] = []
): IncomeStatementLine[] {
  const ertrag = netOnAccounts(entries, from, to, [3], "credit")
  const material = netOnAccounts(entries, from, to, [4], "debit")
  const brutto = roundChf(ertrag - material)
  const personal = netOnAccounts(entries, from, to, [5], "debit")
  const uebrig = netOnAccounts(entries, from, to, [6], "debit")
  const betrieb = roundChf(brutto - personal - uebrig)
  const finanz = netOnAccounts(entries, from, to, [8], "credit")
  const finanzAufwand = netOnAccounts(entries, from, to, [8], "debit")
  const ausserord = netOnAccounts(entries, from, to, [9], "credit")
  const erfolg = roundChf(betrieb + finanz - finanzAufwand + ausserord)

  return [
    {
      id: "ertrag",
      label: "Betrieblicher Ertrag aus Lieferungen und Leistungen (Klasse 3)",
      amount: ertrag,
      level: 1,
      expandable: true,
      accounts: collectIncomeAccountDetails(entries, accounts, from, to, [3], "credit"),
    },
    {
      id: "material",
      label: "Aufwand für Material, Handelswaren, Dienstleistungen (Klasse 4)",
      amount: -material,
      level: 1,
      expandable: true,
      accounts: collectIncomeAccountDetails(entries, accounts, from, to, [4], "debit"),
    },
    { id: "brutto", label: "= Bruttoergebnis", amount: brutto, level: 0, emphasis: true },
    {
      id: "personal",
      label: "Personalaufwand (Klasse 5)",
      amount: -personal,
      level: 1,
      expandable: true,
      accounts: collectIncomeAccountDetails(entries, accounts, from, to, [5], "debit"),
    },
    {
      id: "uebrig",
      label: "Übriger betrieblicher Aufwand (Klasse 6)",
      amount: -uebrig,
      level: 1,
      expandable: true,
      accounts: collectIncomeAccountDetails(entries, accounts, from, to, [6], "debit"),
    },
    { id: "betrieb", label: "= Betriebsergebnis (EBIT)", amount: betrieb, level: 0, emphasis: true },
    {
      id: "finanz",
      label: "Finanzerfolg (Klasse 8)",
      amount: roundChf(finanz - finanzAufwand),
      level: 1,
      expandable: true,
      accounts: collectIncomeAccountDetails(entries, accounts, from, to, [8], "credit"),
    },
    {
      id: "ausser",
      label: "Ausserordentlicher Erfolg (Klasse 9)",
      amount: ausserord,
      level: 1,
      expandable: true,
      accounts: collectIncomeAccountDetails(entries, accounts, from, to, [9], "credit"),
    },
    {
      id: "erfolg",
      label: "= Unternehmenserfolg (Gewinn / Verlust)",
      amount: erfolg,
      level: 0,
      emphasis: true,
    },
  ]
}

export function buildBalanceSheet(
  entries: JournalEntry[],
  to: string,
  accounts: Account[] = []
): BalanceSheetLine[] {
  const fluessig = balanceForPrefix(entries, to, ["100", "102", "106"], "aktiv")
  const forderungen = balanceForPrefix(entries, to, ["110", "114", "117"], "aktiv")
  const umlauf = roundChf(fluessig + forderungen)
  const anlage = balanceForPrefix(entries, to, ["140", "144", "150", "160"], "aktiv")
  const aktivenTotal = roundChf(umlauf + anlage)

  const kurzFk = balanceForPrefix(entries, to, ["200", "210", "220"], "passiv")
  const langFk = balanceForPrefix(entries, to, ["240", "250", "260"], "passiv")
  const eigen = balanceForPrefix(entries, to, ["280", "285", "290", "299"], "passiv")
  const passivenTotal = roundChf(kurzFk + langFk + eigen)

  return [
    {
      id: "aktiven-h",
      label: "AKTIVEN",
      amount: aktivenTotal,
      level: 0,
      section: "aktiven",
      emphasis: true,
    },
    {
      id: "umlauf-h",
      label: "Umlaufvermögen",
      amount: umlauf,
      level: 1,
      section: "aktiven",
      expandable: true,
      accounts: [
        ...collectBalanceAccountDetails(entries, accounts, to, ["100", "102", "106"], "aktiv"),
        ...collectBalanceAccountDetails(entries, accounts, to, ["110", "114", "117"], "aktiv"),
      ],
    },
    {
      id: "fluessig",
      label: "Flüssige Mittel",
      amount: fluessig,
      level: 2,
      section: "aktiven",
      expandable: true,
      accounts: collectBalanceAccountDetails(
        entries,
        accounts,
        to,
        ["100", "102", "106"],
        "aktiv"
      ),
    },
    {
      id: "forderungen",
      label: "Forderungen",
      amount: forderungen,
      level: 2,
      section: "aktiven",
      expandable: true,
      accounts: collectBalanceAccountDetails(
        entries,
        accounts,
        to,
        ["110", "114", "117"],
        "aktiv"
      ),
    },
    {
      id: "anlage-h",
      label: "Anlagevermögen",
      amount: anlage,
      level: 1,
      section: "aktiven",
      expandable: true,
      accounts: collectBalanceAccountDetails(
        entries,
        accounts,
        to,
        ["140", "144", "150", "160"],
        "aktiv"
      ),
    },
    {
      id: "aktiven-t",
      label: "Total Aktiven",
      amount: aktivenTotal,
      level: 0,
      section: "aktiven",
      emphasis: true,
    },
    {
      id: "passiven-h",
      label: "PASSIVEN",
      amount: passivenTotal,
      level: 0,
      section: "passiven",
      emphasis: true,
    },
    {
      id: "kurz-h",
      label: "Kurzfristiges Fremdkapital",
      amount: kurzFk,
      level: 1,
      section: "passiven",
      expandable: true,
      accounts: collectBalanceAccountDetails(
        entries,
        accounts,
        to,
        ["200", "210", "220"],
        "passiv"
      ),
    },
    {
      id: "lang-h",
      label: "Langfristiges Fremdkapital",
      amount: langFk,
      level: 1,
      section: "passiven",
      expandable: true,
      accounts: collectBalanceAccountDetails(
        entries,
        accounts,
        to,
        ["240", "250", "260"],
        "passiv"
      ),
    },
    {
      id: "eigen-h",
      label: "Eigenkapital",
      amount: eigen,
      level: 1,
      section: "passiven",
      expandable: true,
      accounts: collectBalanceAccountDetails(
        entries,
        accounts,
        to,
        ["280", "285", "290", "299"],
        "passiv"
      ),
    },
    {
      id: "passiven-t",
      label: "Total Passiven",
      amount: passivenTotal,
      level: 0,
      section: "passiven",
      emphasis: true,
    },
  ]
}

export function matchesSearchQuery(
  query: string,
  values: Array<string | number | null | undefined>
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return values.some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(q)
  )
}

/** ER/Bilanz-Gerüst mit 0.00 CHF – immer sichtbar, auch ohne Buchungen. */
export function emptyIncomeStatementLayout(): IncomeStatementLine[] {
  return buildIncomeStatement([], "1900-01-01", "2100-12-31", [])
}

export function emptyBalanceSheetLayout(): BalanceSheetLine[] {
  return buildBalanceSheet([], "2100-12-31", [])
}
