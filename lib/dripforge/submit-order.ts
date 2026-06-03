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

    let data: SubmitOrderResponse & { error?: string }
    try {
      data = (await response.json()) as SubmitOrderResponse & { error?: string }
    } catch (parseError) {
      console.error(
        "Bestellung: Ungültige Server-Antwort.",
        { status: response.status, parseError }
      )
      return {
        ok: false,
        error: "Server-Antwort ungültig. Bitte später erneut versuchen.",
      }
    }

    if (!response.ok) {
      console.error("Bestellung: API-Fehler.", {
        status: response.status,
        error: data.error,
      })
      return {
        ok: false,
        error: data.error ?? "Bestellung konnte nicht übermittelt werden.",
      }
    }

    return { ok: true, data }
  } catch (error) {
    console.error("Bestellung: Netzwerkfehler bei der Übermittlung.", error)
    return {
      ok: false,
      error: "Verbindungsfehler. Bitte später erneut versuchen.",
    }
  }
}
