"use client"

import { loadStripe, type Stripe } from "@stripe/stripe-js"

let stripePromise: Promise<Stripe | null> | null = null
let loadedKey: string | null = null

/**
 * Lädt Stripe.js mit dem zur Laufzeit geholten Publishable Key.
 * Ruft loadStripe erst auf, wenn ein nicht-leerer Key vorhanden ist.
 */
export function loadBrowserStripe(publishableKey: string): Promise<Stripe | null> {
  const key = publishableKey.trim()
  if (!key) {
    console.error(
      "[Stripe] loadStripe übersprungen — Publishable Key fehlt (undefined/leer)."
    )
    return Promise.resolve(null)
  }
  if (!key.startsWith("pk_live_") && !key.startsWith("pk_test_")) {
    console.error(
      "[Stripe] loadStripe übersprungen — Key-Prefix ungültig:",
      key.slice(0, 8)
    )
    return Promise.resolve(null)
  }

  if (!stripePromise || loadedKey !== key) {
    loadedKey = key
    stripePromise = loadStripe(key).catch((error) => {
      console.error("[Stripe] loadStripe fehlgeschlagen.", error)
      stripePromise = null
      loadedKey = null
      return null
    })
  }
  return stripePromise
}

export type StripeConfigResponse = {
  publishableKey: string | null
  configured?: boolean
  diagnostics?: {
    publishableKeyPresent?: boolean
    publishableKeyMode?: string
    secretKeyMode?: string
    modeMismatch?: boolean
    checkoutMode?: string
  }
}

/** Holt den Publishable Key von /api/stripe/config (Azure Runtime). */
export async function fetchStripePublishableKey(): Promise<StripeConfigResponse> {
  const res = await fetch("/api/stripe/config", { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Stripe-Config HTTP ${res.status}`)
  }
  return (await res.json()) as StripeConfigResponse
}
