import { getOrderById, saveOrder } from "@/lib/admin/db"
import type { StoredOrder } from "@/lib/admin/types"
import { recordOrderPaymentJournalEntry } from "@/lib/accounting/order-journal"
import { fulfillPaidShopOrder } from "@/lib/shop/order-processing"

export type ConfirmPaymentResult =
  | { ok: true; order: StoredOrder; alreadyConfirmed: boolean }
  | { ok: false; error: string }

/**
 * Manuelle Zahlungsbestätigung für Rechnung/TWINT-Bestellungen.
 *
 * - Setzt `paymentConfirmed`/`paymentStatus` auf bezahlt, damit die Bestellung
 *   in den Dashboard-Umsatz einfliesst (siehe isPaidOrderForRevenue).
 * - Rückt den Produktionsstatus von "bestellungseingang" auf "bezahlt".
 * - TWINT: nutzt die volle Fulfillment-Logik (Punkte, Lager, Journal),
 *   da diese Bestellungen erst bei Zahlungseingang abgeschlossen werden.
 * - Rechnung: Punkte/Lager wurden bereits bei Bestelleingang gutgeschrieben,
 *   daher nur Zahlung bestätigen + Buchungsjournal nachziehen.
 */
export async function confirmOrderPaymentManually(
  orderId: string
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
    // TWINT wird wie eine späte Zahlung abgeschlossen (voll fulfillen: Punkte,
    // Lager, Journal). fulfillPaidShopOrder rückt den Produktionsstatus selbst
    // auf "bezahlt".
    await fulfillPaidShopOrder(orderId, { skipInboundEmails: false })
    const latest = (await getOrderById(orderId)) ?? existing
    return { ok: true, order: latest, alreadyConfirmed: false }
  }

  // Rechnung u. a.: Zahlung in EINEM Update bestätigen (Gutschriften erfolgten
  // bereits bei Bestelleingang).
  const paid: StoredOrder = {
    ...existing,
    paymentConfirmed: true,
    paymentStatus: "paid",
    ...(advanceProduction ? { productionStatus: "bezahlt" as const } : {}),
  }
  await saveOrder(paid)
  try {
    await recordOrderPaymentJournalEntry(paid)
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
