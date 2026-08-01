import type Stripe from "stripe"
import type { StoredOrder } from "@/lib/admin/types"

function toUnitAmountCents(priceChf: unknown): number | null {
  const n = typeof priceChf === "number" ? priceChf : Number(priceChf)
  if (!Number.isFinite(n) || n < 0) return null
  const cents = Math.round(n * 100)
  if (!Number.isFinite(cents) || cents < 0) return null
  return cents
}

function productName(raw: unknown, fallback: string): string {
  const name = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 500)
  return name || fallback
}

/**
 * Dynamische line_items mit price_data — keine hartcodierten Test-Price/Product-IDs.
 * Ungültige / 0-Beträge werden herausgefiltert (Stripe lehnt unit_amount <= 0 ab).
 */
export function buildCheckoutLineItems(
  order: StoredOrder
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []

  for (const [index, item] of order.items.entries()) {
    const unitAmount = toUnitAmountCents(item.price)
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1))
    if (unitAmount == null || unitAmount <= 0) {
      console.warn("[Stripe Checkout] Position übersprungen (ungültiger Preis).", {
        index,
        name: item.name,
        price: item.price,
      })
      continue
    }
    lineItems.push({
      quantity,
      price_data: {
        currency: "chf",
        unit_amount: unitAmount,
        product_data: {
          name: productName(item.name, `Artikel ${index + 1}`),
        },
      },
    })
  }

  if (order.totals.shippingCost > 0) {
    const shippingCents = toUnitAmountCents(order.totals.shippingCost)
    if (shippingCents != null && shippingCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "chf",
          unit_amount: shippingCents,
          product_data: { name: "Versand" },
        },
      })
    }
  }

  const pointsPurchaseChf = order.totals.pointsPurchaseChf ?? 0
  if (pointsPurchaseChf > 0) {
    const pointsCents = toUnitAmountCents(pointsPurchaseChf)
    if (pointsCents != null && pointsCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "chf",
          unit_amount: pointsCents,
          product_data: { name: "Treuepunkte-Kauf" },
        },
      })
    }
  }

  if (order.totals.mwstAktiv && order.totals.vat > 0) {
    const vatCents = toUnitAmountCents(order.totals.vat)
    if (vatCents != null && vatCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "chf",
          unit_amount: vatCents,
          product_data: { name: "MwSt." },
        },
      })
    }
  }

  return lineItems
}

export function sumLineItemsCents(
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[]
): number {
  return lineItems.reduce((sum, line) => {
    const unit = line.price_data?.unit_amount ?? 0
    const qty = line.quantity ?? 1
    return sum + unit * qty
  }, 0)
}

export async function buildCheckoutDiscounts(
  stripe: Stripe,
  lineTotalCents: number,
  chargeTotalCents: number
): Promise<Stripe.Checkout.SessionCreateParams.Discount[] | undefined> {
  const discountCents = lineTotalCents - chargeTotalCents
  if (discountCents <= 0) return undefined
  if (discountCents >= lineTotalCents) {
    console.warn(
      "[Stripe Checkout] Rabatt >= Line-Total — Coupon übersprungen.",
      { discountCents, lineTotalCents }
    )
    return undefined
  }

  try {
    const coupon = await stripe.coupons.create({
      amount_off: discountCents,
      currency: "chf",
      duration: "once",
      name: "Rabatt / Treuepunkte",
    })
    return [{ coupon: coupon.id }]
  } catch (error) {
    console.error("Stripe Checkout Error:", error)
    console.error("[Stripe Checkout] Coupon-Erstellung fehlgeschlagen — ohne Rabatt weiter.", error)
    return undefined
  }
}
