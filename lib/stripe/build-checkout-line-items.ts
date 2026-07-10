import type Stripe from "stripe"
import type { StoredOrder } from "@/lib/admin/types"

export function buildCheckoutLineItems(
  order: StoredOrder
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map(
    (item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "chf",
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: item.name.slice(0, 500),
        },
      },
    })
  )

  if (order.totals.shippingCost > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "chf",
        unit_amount: Math.round(order.totals.shippingCost * 100),
        product_data: { name: "Versand" },
      },
    })
  }

  const pointsPurchaseChf = order.totals.pointsPurchaseChf ?? 0
  if (pointsPurchaseChf > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "chf",
        unit_amount: Math.round(pointsPurchaseChf * 100),
        product_data: { name: "Treuepunkte-Kauf" },
      },
    })
  }

  if (order.totals.mwstAktiv && order.totals.vat > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "chf",
        unit_amount: Math.round(order.totals.vat * 100),
        product_data: { name: "MwSt." },
      },
    })
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

  const coupon = await stripe.coupons.create({
    amount_off: discountCents,
    currency: "chf",
    duration: "once",
    name: "Rabatt / Treuepunkte",
  })

  return [{ coupon: coupon.id }]
}
