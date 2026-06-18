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
  couponCode?: string
  pointsToRedeem?: number
  totals: {
    subtotal: number
    shippingCost: number
    discountAmount?: number
    couponCode?: string
    pointsRedeemed?: number
    pointsDiscountChf?: number
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

export type StripeCheckoutResult =
  | { ok: true; url: string; sessionId: string; orderId: string }
  | { ok: false; error: string }

export type TwintCheckoutResult =
  | { ok: true; url: string; gatewayHash: string; orderId: string }
  | { ok: false; error: string }

export async function startStripeCheckout(
  payload: OrderPayload
): Promise<StripeCheckoutResult> {
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as {
      url?: string
      sessionId?: string
      orderId?: string
      pointsOnly?: boolean
      error?: string
    }

    if (!response.ok || !data.url) {
      return {
        ok: false,
        error: data.error ?? "Stripe Checkout konnte nicht gestartet werden.",
      }
    }

    return {
      ok: true,
      url: data.url,
      sessionId: data.sessionId ?? "",
      orderId: data.orderId ?? "",
    }
  } catch (error) {
    console.error("Checkout: Netzwerkfehler.", error)
    return {
      ok: false,
      error: "Verbindungsfehler. Bitte später erneut versuchen.",
    }
  }
}

export async function startTwintCheckout(
  payload: OrderPayload
): Promise<TwintCheckoutResult> {
  try {
    const response = await fetch("/api/checkout/twint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as {
      url?: string
      gatewayHash?: string
      orderId?: string
      pointsOnly?: boolean
      error?: string
    }

    if (!response.ok || !data.url) {
      return {
        ok: false,
        error: data.error ?? "TWINT-Checkout konnte nicht gestartet werden.",
      }
    }

    return {
      ok: true,
      url: data.url,
      gatewayHash: data.gatewayHash ?? "",
      orderId: data.orderId ?? "",
    }
  } catch (error) {
    console.error("TWINT Checkout: Netzwerkfehler.", error)
    return {
      ok: false,
      error: "Verbindungsfehler. Bitte später erneut versuchen.",
    }
  }
}

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
