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
  /** Punktepaket im Checkout (wird dem Gesamtbetrag aufgeschlagen) */
  pointsPurchase?: {
    packageId?: string
    customAmountChf?: number
  }
  /** Eingeloggter Kunde: Checkout-Adresse im Konto speichern (Default: true) */
  saveAddressToAccount?: boolean
  totals: {
    subtotal: number
    shippingCost: number
    discountAmount?: number
    couponCode?: string
    pointsRedeemed?: number
    pointsDiscountChf?: number
    pointsPurchaseChf?: number
    pointsPurchased?: number
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
  | {
      ok: true
      orderId: string
      twintPaymentUrl: string
      amountChf: number
      amountFormatted: string
      successPath: string
    }
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
      stripeCode?: string | null
      stripeType?: string | null
      payment_method_types?: string[]
    }

    if (!response.ok || !data.url) {
      console.error("[Stripe Checkout] API-Fehler", {
        status: response.status,
        error: data.error,
        stripeCode: data.stripeCode,
        stripeType: data.stripeType,
        payment_method_types: data.payment_method_types,
      })
      const detail = [data.error, data.stripeCode ? `(${data.stripeCode})` : null]
        .filter(Boolean)
        .join(" ")
      return {
        ok: false,
        error: detail || "Stripe Checkout konnte nicht gestartet werden.",
      }
    }

    console.info("[Stripe Checkout] Redirect zur Stripe-Seite", {
      sessionId: data.sessionId,
      orderId: data.orderId,
    })

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
      body: JSON.stringify({ ...payload, paymentMethod: "twint" }),
    })

    const data = (await response.json()) as {
      orderId?: string
      twintPaymentUrl?: string
      amountChf?: number
      amountFormatted?: string
      successPath?: string
      error?: string
    }

    if (!response.ok || !data.orderId || !data.twintPaymentUrl) {
      return {
        ok: false,
        error: data.error ?? "TWINT-Checkout konnte nicht gestartet werden.",
      }
    }

    return {
      ok: true,
      orderId: data.orderId,
      twintPaymentUrl: data.twintPaymentUrl,
      amountChf: data.amountChf ?? payload.totals.total,
      amountFormatted:
        data.amountFormatted ?? payload.totals.total.toFixed(2),
      successPath:
        data.successPath ??
        `/bestellung/erfolg?order_id=${encodeURIComponent(data.orderId)}&method=twint`,
    }
  } catch (error) {
    console.error("TWINT-Checkout: Netzwerkfehler.", error)
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
      credentials: "include",
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
