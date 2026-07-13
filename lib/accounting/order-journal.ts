import type { PaymentMethodId } from "@/lib/dripforge/checkout-config"
import type { StoredOrder, StoredOrderItem } from "@/lib/admin/types"
import { getAccountingAccountConfig } from "@/lib/accounting/account-config"
import {
  cosmosCreateJournalEntry,
  cosmosGetJournalEntryBySourceOrderId,
} from "@/lib/admin/cosmos-journal"
import type { JournalLine } from "@/lib/accounting/journal-types"
import { validateJournalEntryLines } from "@/lib/accounting/journal-types"

function roundChf(value: number): number {
  return Math.round(value * 100) / 100
}

function itemSubtotal(item: StoredOrderItem): number {
  return roundChf(item.price * item.quantity)
}

function splitRevenueByType(items: StoredOrderItem[]): {
  revenue3d: number
  revenueLaser: number
} {
  let revenue3d = 0
  let revenueLaser = 0
  for (const item of items) {
    const subtotal = itemSubtotal(item)
    if (item.type === "laser") {
      revenueLaser += subtotal
    } else {
      revenue3d += subtotal
    }
  }
  return { revenue3d: roundChf(revenue3d), revenueLaser: roundChf(revenueLaser) }
}

function allocateDiscountedRevenue(order: StoredOrder): {
  revenue3d: number
  revenueLaser: number
} {
  const { revenue3d, revenueLaser } = splitRevenueByType(order.items)
  const itemSubtotal = revenue3d + revenueLaser
  const discount = roundChf(order.totals.discountAmount ?? 0)
  const shipping = roundChf(order.totals.shippingCost ?? 0)
  const netBeforeVat = roundChf(
    Math.max(0, itemSubtotal - discount) + shipping
  )

  if (netBeforeVat <= 0) {
    return { revenue3d: 0, revenueLaser: 0 }
  }

  if (itemSubtotal <= 0) {
    return { revenue3d: netBeforeVat, revenueLaser: 0 }
  }

  const discountedItems = Math.max(0, itemSubtotal - discount)
  const ratio3d = revenue3d / itemSubtotal
  const ratioLaser = revenueLaser / itemSubtotal
  const allocatedItems3d = roundChf(discountedItems * ratio3d)
  const allocatedItemsLaser = roundChf(discountedItems * ratioLaser)
  const shipping3d = roundChf(shipping * ratio3d)
  const shippingLaser = roundChf(shipping - shipping3d)

  let net3d = roundChf(allocatedItems3d + shipping3d)
  let netLaser = roundChf(allocatedItemsLaser + shippingLaser)
  const diff = roundChf(netBeforeVat - (net3d + netLaser))
  if (diff !== 0) {
    if (net3d >= netLaser) net3d = roundChf(net3d + diff)
    else netLaser = roundChf(netLaser + diff)
  }

  return { revenue3d: net3d, revenueLaser: netLaser }
}

function resolveCounterAccount(
  paymentMethod: PaymentMethodId,
  config: ReturnType<typeof getAccountingAccountConfig>
): string {
  if (paymentMethod === "invoice") return config.receivable
  if (paymentMethod === "twint") return config.bank
  return config.bank
}

function defaultVatRate(order: StoredOrder): number {
  if (!order.totals.mwstAktiv) return 0
  const net = roundChf((order.totals.total ?? 0) - (order.totals.vat ?? 0))
  if (net <= 0) return 0.081
  return roundChf((order.totals.vat ?? 0) / net)
}

export function buildOrderPaymentJournalLines(order: StoredOrder): JournalLine[] {
  const config = getAccountingAccountConfig()
  const total = roundChf(order.totals.total ?? 0)
  if (total <= 0) return []

  const vat = roundChf(order.totals.vat ?? 0)
  const { revenue3d, revenueLaser } = allocateDiscountedRevenue(order)
  const vatRate = defaultVatRate(order)
  const counterAccount = resolveCounterAccount(order.paymentMethod, config)

  const lines: JournalLine[] = [
    {
      accountNumber: counterAccount,
      type: "SOLL",
      amount: total,
      taxRate: 0,
    },
  ]

  if (revenue3d > 0) {
    lines.push({
      accountNumber: config.revenue3d,
      type: "HABEN",
      amount: revenue3d,
      taxRate: vatRate,
    })
  }

  if (revenueLaser > 0) {
    lines.push({
      accountNumber: config.revenueLaser,
      type: "HABEN",
      amount: revenueLaser,
      taxRate: vatRate,
    })
  }

  if (vat > 0) {
    lines.push({
      accountNumber: config.vatPayable,
      type: "HABEN",
      amount: vat,
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
        lines.find((l) => l.type === "HABEN" && l.accountNumber === config.revenue3d) ??
        lines.find((l) => l.type === "HABEN")
      if (revenueLine) {
        revenueLine.amount = roundChf(revenueLine.amount + adjustment)
      }
    }
  }

  return lines
}

export async function recordOrderPaymentJournalEntry(
  order: StoredOrder
): Promise<{ recorded: boolean; entryId?: string; reason?: string }> {
  if (!order.paymentConfirmed) {
    return { recorded: false, reason: "payment_not_confirmed" }
  }

  const existing = await cosmosGetJournalEntryBySourceOrderId(order.orderId)
  if (existing) {
    return { recorded: false, reason: "already_recorded", entryId: existing.id }
  }

  const lines = buildOrderPaymentJournalLines(order)
  if (!lines.length) {
    return { recorded: false, reason: "empty_lines" }
  }

  const validation = validateJournalEntryLines(lines)
  if (!validation.valid) {
    console.error(
      `Buchhaltung: Automatische Buchung für ${order.orderId} ungültig: ${validation.error}`
    )
    return { recorded: false, reason: "invalid_lines" }
  }

  const entry = await cosmosCreateJournalEntry({
    date: order.createdAt.slice(0, 10),
    description: `Verkauf Bestellung ${order.orderId}`,
    lines,
    source: "order",
    sourceOrderId: order.orderId,
  })

  return { recorded: true, entryId: entry.id }
}
