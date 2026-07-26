import { getAccountingAccountConfig } from "@/lib/accounting/account-config"
import type { JournalLine } from "@/lib/accounting/journal-types"
import { validateJournalEntryLines } from "@/lib/accounting/journal-types"
import {
  cosmosCreateJournalEntry,
  cosmosGetJournalEntryBySourceBelegId,
} from "@/lib/admin/cosmos-journal"
import { defaultBelegRevenueAccountCode } from "@/lib/documents/beleg-accounts"
import {
  computeBelegTotals,
  roundChf,
  type Beleg,
} from "@/lib/documents/beleg-types"

/**
 * Baut Journalzeilen aus einer bezahlten Rechnung:
 * SOLL Forderungen = Total inkl. MwSt.
 * HABEN Ertragskonto je Position (Netto nach Rabatt, gruppiert nach Konto/Steuer)
 * HABEN MWST-Konto = Summe MwSt.
 */
export function buildBelegPaymentJournalLines(beleg: Beleg): JournalLine[] {
  const config = getAccountingAccountConfig()
  const totals = computeBelegTotals(beleg.positionen)
  const total = roundChf(beleg.total || totals.total)
  const vatTotal = roundChf(beleg.vatTotal || totals.vatTotal)
  if (total <= 0) return []

  const lines: JournalLine[] = [
    {
      accountNumber: config.receivable,
      type: "SOLL",
      amount: total,
      taxRate: 0,
    },
  ]

  type Bucket = {
    accountNumber: string
    amount: number
    taxRate: number
    taxCode?: string
  }
  const buckets = new Map<string, Bucket>()

  for (const pos of beleg.positionen) {
    const net = roundChf(pos.lineTotal || 0)
    if (net <= 0) continue
    const accountNumber =
      String(pos.accountCode ?? "").trim() || defaultBelegRevenueAccountCode()
    const taxRate =
      Number.isFinite(pos.taxRate) && pos.taxRate >= 0
        ? pos.taxRate
        : Math.max(0, Number(pos.taxRatePercent) || 0) / 100
    const taxCode = pos.taxCode || undefined
    const key = `${accountNumber}|${taxRate}|${taxCode ?? ""}`
    const prev = buckets.get(key)
    if (prev) {
      prev.amount = roundChf(prev.amount + net)
    } else {
      buckets.set(key, { accountNumber, amount: net, taxRate, taxCode })
    }
  }

  for (const bucket of buckets.values()) {
    lines.push({
      accountNumber: bucket.accountNumber,
      type: "HABEN",
      amount: bucket.amount,
      taxRate: bucket.taxRate,
      taxCode: bucket.taxCode,
    })
  }

  if (vatTotal > 0) {
    lines.push({
      accountNumber: config.vatPayable,
      type: "HABEN",
      amount: vatTotal,
      taxRate: 0,
    })
  }

  const validation = validateJournalEntryLines(lines)
  if (!validation.valid) {
    const habenSum = roundChf(
      lines.filter((l) => l.type === "HABEN").reduce((s, l) => s + l.amount, 0)
    )
    const adjustment = roundChf(total - habenSum)
    if (adjustment !== 0) {
      const revenueLine =
        lines.find((l) => l.type === "HABEN" && (l.taxRate > 0 || l.taxCode)) ??
        lines.find((l) => l.type === "HABEN")
      if (revenueLine) {
        revenueLine.amount = roundChf(revenueLine.amount + adjustment)
      }
    }
  }

  return lines
}

export async function recordBelegPaymentJournalEntry(
  beleg: Beleg
): Promise<{ recorded: boolean; entryId?: string; reason?: string }> {
  if (beleg.type !== "rechnung") {
    return { recorded: false, reason: "not_invoice" }
  }
  if (beleg.status !== "bezahlt") {
    return { recorded: false, reason: "not_paid" }
  }

  const existing = await cosmosGetJournalEntryBySourceBelegId(beleg.id)
  if (existing) {
    return { recorded: false, reason: "already_recorded", entryId: existing.id }
  }

  const lines = buildBelegPaymentJournalLines(beleg)
  if (!lines.length) {
    return { recorded: false, reason: "empty_lines" }
  }

  const validation = validateJournalEntryLines(lines)
  if (!validation.valid) {
    console.error(
      `Buchhaltung: Automatische Beleg-Buchung für ${beleg.id} ungültig: ${validation.error}`
    )
    return { recorded: false, reason: "invalid_lines" }
  }

  const entry = await cosmosCreateJournalEntry({
    date: (beleg.updatedAt || beleg.createdAt || new Date().toISOString()).slice(
      0,
      10
    ),
    description: `Verkauf Rechnung ${beleg.id}`,
    belegNummer: beleg.id,
    lines,
    source: "beleg",
    sourceBelegId: beleg.id,
    sourceOrderId: beleg.sourceOrderId ?? undefined,
  })

  return { recorded: true, entryId: entry.id }
}
