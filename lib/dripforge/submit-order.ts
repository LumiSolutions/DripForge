import type { CartItem } from "@/lib/dripforge/types"
import type { PaymentMethodId, ShippingMethodId } from "@/lib/dripforge/checkout-config"

export type OrderAddress = {
  firstName: string
  lastName: string
  street: string
  zip: string
  city: string
  country: string
  email: string
  phone: string
}

export type OrderPayload = {
  billing: OrderAddress
  delivery?: OrderAddress
  shippingMethod: ShippingMethodId
  paymentMethod: PaymentMethodId
  items: CartItem[]
  totals: {
    subtotal: number
    shippingCost: number
    vat: number
    total: number
    mwstAktiv: boolean
  }
}

export type OrderItemResult = {
  id: string
  leitbildUrl: string | null
}

export type SubmitOrderResponse = {
  orderId: string
  items: OrderItemResult[]
  message: string
}

export type SubmitOrderResult =
  | { ok: true; data: SubmitOrderResponse }
  | { ok: false; error: string }

export async function submitOrder(
  payload: OrderPayload
): Promise<SubmitOrderResult> {
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as SubmitOrderResponse & {
      error?: string
    }

    if (!response.ok) {
      return {
        ok: false,
        error: data.error ?? "Bestellung konnte nicht uebermittelt werden.",
      }
    }

    return { ok: true, data }
  } catch (error) {
    console.warn("Bestellung: Netzwerkfehler bei der Uebermittlung.", error)
    return {
      ok: false,
      error: "Verbindungsfehler. Bitte spaeter erneut versuchen.",
    }
  }
}
