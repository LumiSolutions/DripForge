import type { StoredOrder } from "@/lib/admin/types"
import {
  cosmosAllocateBelegNummer,
  cosmosFindBelegBySourceOrderId,
  cosmosGetBelegById,
  cosmosUpsertBeleg,
} from "@/lib/admin/cosmos-belege"
import { getAccountingAccountConfig } from "@/lib/accounting/account-config"
import {
  computeBelegTotals,
  defaultStatusForType,
  normalizeBeleg,
  normalizeBelegPosition,
  stripPricesForDeliveryNote,
  type Beleg,
  type BelegPosition,
  type BelegStatus,
  type BelegType,
} from "@/lib/documents/beleg-types"
import { resolveBelegVatFields } from "@/lib/documents/beleg-vat"
import { formatInvoiceItemDetails } from "@/lib/invoices/invoice-item-details"

export async function createBelegDraft(input: {
  type: BelegType
  status?: BelegStatus
  kunde: Beleg["kunde"]
  lieferAdresse?: Beleg["lieferAdresse"]
  positionen: Array<Partial<BelegPosition>>
  notes?: string
  linkedTo?: string | null
  sourceOrderId?: string | null
}): Promise<Beleg> {
  const id = await cosmosAllocateBelegNummer(input.type)
  const positionen = (input.positionen ?? []).map((p, i) =>
    normalizeBelegPosition(p ?? {}, i)
  )
  const totals = computeBelegTotals(positionen)
  const beleg = normalizeBeleg({
    id,
    type: input.type,
    status: input.status ?? defaultStatusForType(input.type),
    kunde: input.kunde,
    lieferAdresse: input.lieferAdresse,
    positionen,
    subtotal: totals.subtotal,
    vatTotal: totals.vatTotal,
    total: totals.total,
    notes: input.notes,
    linkedTo: input.linkedTo ?? null,
    sourceOrderId: input.sourceOrderId ?? null,
  })
  return cosmosUpsertBeleg(beleg)
}

export async function convertBeleg(
  sourceId: string,
  targetType: BelegType
): Promise<Beleg> {
  const source = await cosmosGetBelegById(sourceId)
  if (!source) throw new Error("Quellbeleg nicht gefunden.")

  if (source.type === "offerte" && targetType === "rechnung") {
    if (source.status !== "angenommen" && source.status !== "offen") {
      throw new Error(
        "Rechnung kann nur aus einer offenen oder angenommenen Offerte erstellt werden."
      )
    }
    return createBelegDraft({
      type: "rechnung",
      status: "offen",
      kunde: source.kunde,
      lieferAdresse: source.lieferAdresse,
      positionen: source.positionen,
      notes: source.notes,
      linkedTo: source.id,
      sourceOrderId: source.sourceOrderId,
    })
  }

  if (source.type === "rechnung" && targetType === "lieferschein") {
    return createBelegDraft({
      type: "lieferschein",
      status: "bereit",
      kunde: source.kunde,
      lieferAdresse: source.lieferAdresse ?? source.kunde,
      positionen: stripPricesForDeliveryNote(source.positionen),
      notes: source.notes,
      linkedTo: source.id,
      sourceOrderId: source.sourceOrderId,
    })
  }

  throw new Error(
    `Umwandlung von ${source.type} nach ${targetType} ist nicht erlaubt.`
  )
}

function orderVatFields(order: StoredOrder) {
  if (!order.totals.mwstAktiv) {
    return resolveBelegVatFields({ taxCode: "U00", taxRate: 0, taxRatePercent: 0 })
  }
  const inferredPercent =
    order.totals.subtotal > 0
      ? Math.round((order.totals.vat / order.totals.subtotal) * 1000) / 10
      : 8.1
  return resolveBelegVatFields({ taxRatePercent: inferredPercent })
}

function orderItemsToPositions(order: StoredOrder): BelegPosition[] {
  const vat = orderVatFields(order)
  const accounts = getAccountingAccountConfig()

  const positions = order.items.map((item, index) =>
    normalizeBelegPosition(
      {
        id: item.id || `item-${index + 1}`,
        name: item.name,
        details: formatInvoiceItemDetails(item) || undefined,
        quantity: item.quantity,
        unit: item.unit || "Stk",
        unitPrice: item.price,
        accountCode:
          item.type === "laser" ? accounts.revenueLaser : accounts.revenue3d,
        discountPercent: 0,
        taxCode: vat.taxCode,
        taxRate: vat.taxRate,
        taxRatePercent: vat.taxRatePercent,
      },
      index
    )
  )

  if ((order.totals.shippingCost ?? 0) > 0) {
    positions.push(
      normalizeBelegPosition(
        {
          id: "shipping",
          name: "Versand",
          quantity: 1,
          unit: "Stk",
          unitPrice: order.totals.shippingCost,
          accountCode: accounts.revenue3d,
          discountPercent: 0,
          taxCode: vat.taxCode,
          taxRate: vat.taxRate,
          taxRatePercent: vat.taxRatePercent,
        },
        positions.length
      )
    )
  }

  return positions
}

/**
 * Shop-Bestellung → Rechnung in der Belegverwaltung (idempotent pro Order).
 */
export async function upsertRechnungFromOrder(order: StoredOrder): Promise<Beleg> {
  const existing = await cosmosFindBelegBySourceOrderId(order.orderId)
  const status: BelegStatus =
    order.paymentMethod === "invoice" && !order.paymentConfirmed
      ? "offen"
      : "bezahlt"

  const positionen = orderItemsToPositions(order)
  // Prefer order totals for consistency with shop invoice PDF
  const subtotal = order.totals.subtotal
  const vatTotal = order.totals.vat
  const total = order.totals.total

  const kunde = {
    firstName: order.billing.firstName,
    lastName: order.billing.lastName,
    email: order.billing.email,
    street: order.billing.street,
    zip: order.billing.zip,
    city: order.billing.city,
    country: order.billing.country || "CH",
  }
  const lieferAdresse = order.delivery
    ? {
        firstName: order.delivery.firstName,
        lastName: order.delivery.lastName,
        email: order.delivery.email || order.billing.email,
        street: order.delivery.street,
        zip: order.delivery.zip,
        city: order.delivery.city,
        country: order.delivery.country || "CH",
      }
    : undefined

  if (existing) {
    return cosmosUpsertBeleg({
      ...existing,
      status,
      kunde,
      lieferAdresse,
      positionen,
      subtotal,
      vatTotal,
      total,
      pdfUrl: order.rechnungPdfUrl ?? existing.pdfUrl,
      sourceOrderId: order.orderId,
      updatedAt: new Date().toISOString(),
    })
  }

  const id = await cosmosAllocateBelegNummer("rechnung")
  const now = new Date().toISOString()
  return cosmosUpsertBeleg({
    id,
    type: "rechnung",
    status,
    kunde,
    lieferAdresse,
    positionen,
    subtotal,
    vatTotal,
    total,
    sourceOrderId: order.orderId,
    pdfUrl: order.rechnungPdfUrl ?? null,
    linkedTo: null,
    createdAt: order.createdAt || now,
    updatedAt: now,
  })
}
