import { getOrderById, saveOrder } from "@/lib/admin/db"
import type { StoredOrder } from "@/lib/admin/types"
import {
  recordOrderPaymentJournalEntry,
  recordOrderSettlementJournalEntry,
  type PaymentSettlementAccount,
} from "@/lib/accounting/order-journal"
import { fulfillPaidShopOrder } from "@/lib/shop/order-processing"

export type ConfirmPaymentOptions = {
  /** Bank Raiffeisen oder Bar/Kasse — Pflicht für Rechnung/Bar. */
  settlementAccount?: PaymentSettlementAccount
  /** Effektives Zahlungsdatum (YYYY-MM-DD), Default: heute. */
  paymentDate?: string
}

export type ConfirmPaymentResult =
  | { ok: true; order: StoredOrder; alreadyConfirmed: boolean }
  | { ok: false; error: string }

function needsSettlementDialog(method: StoredOrder["paymentMethod"]): boolean {
  return method === "invoice" || method === "cash"
}

/**
 * Manuelle Zahlungsbestätigung für Rechnung/Bar/TWINT.
 *
 * - Rechnung/Bar: Dialog wählt Bank oder Kasse → Forderung auflösen + Zahlungseingang.
 * - TWINT: volle Fulfillment-Logik (Punkte, Lager, Bank-Verkaufsbuchung).
 */
export async function confirmOrderPaymentManually(
  orderId: string,
  options?: ConfirmPaymentOptions
): Promise<ConfirmPaymentResult> {
  const existing = await getOrderById(orderId)
  if (!existing) {
    return { ok: false, error: "Bestellung nicht gefunden." }
  }

  if (existing.paymentConfirmed === true || existing.paymentStatus === "paid") {
    return { ok: true, order: existing, alreadyConfirmed: true }
  }

  const advanceProduction =
    !existing.productionStatus || existing.productionStatus === "bestellungseingang"

  if (existing.paymentMethod === "twint") {
    await fulfillPaidShopOrder(orderId, { skipInboundEmails: false })
    const latest = (await getOrderById(orderId)) ?? existing
    return { ok: true, order: latest, alreadyConfirmed: false }
  }

  if (needsSettlementDialog(existing.paymentMethod)) {
    const settlement = options?.settlementAccount
    if (settlement !== "bank" && settlement !== "cash") {
      return {
        ok: false,
        error:
          "Bitte Zahlungseingangs-Konto wählen (Bank Raiffeisen oder Bar/Kasse).",
      }
    }
  }

  const paid: StoredOrder = {
    ...existing,
    paymentConfirmed: true,
    paymentStatus: "paid",
    ...(advanceProduction ? { productionStatus: "bezahlt" as const } : {}),
  }
  await saveOrder(paid)

  try {
    if (needsSettlementDialog(paid.paymentMethod)) {
      // Forderung (falls noch nicht vorhanden) + Zahlungseingang Bank/Kasse
      await recordOrderSettlementJournalEntry(paid, {
        settlementAccount: options!.settlementAccount!,
        paymentDate: options?.paymentDate,
      })
    } else {
      await recordOrderPaymentJournalEntry(paid, {
        bookingDate: options?.paymentDate,
      })
    }
  } catch (error) {
    console.error(
      `Zahlungsbestätigung: Buchungsjournal für ${orderId} fehlgeschlagen.`,
      error
    )
  }

  try {
    const { upsertRechnungFromOrder } = await import(
      "@/lib/documents/beleg-service"
    )
    await upsertRechnungFromOrder(paid)
  } catch (error) {
    console.error(
      `Zahlungsbestätigung: Beleg-Sync für ${orderId} fehlgeschlagen.`,
      error
    )
  }

  return { ok: true, order: paid, alreadyConfirmed: false }
}
