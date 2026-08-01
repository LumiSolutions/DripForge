import Stripe from "stripe"
import { resolveSiteOrigin } from "@/lib/site/site-origin"

let stripeClient: Stripe | null = null

function secretKeyRaw(): string {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? ""
}

function publishableKeyRaw(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? ""
}

export function isStripeConfigured(): boolean {
  const key = secretKeyRaw()
  if (!key) return false
  if (key.includes("placeholder") || key.includes("sk_test_xxx")) return false
  // Live- und Test-Keys akzeptieren — nur offensichtliche Dummy-Werte ablehnen
  if (!key.startsWith("sk_live_") && !key.startsWith("sk_test_")) return false
  return true
}

export type StripeEnvDiagnostics = {
  configured: boolean
  secretKeyPresent: boolean
  secretKeyMode: "live" | "test" | "unknown" | "missing"
  publishableKeyPresent: boolean
  publishableKeyMode: "live" | "test" | "unknown" | "missing"
  modeMismatch: boolean
  webhookSecretPresent: boolean
  /** Hinweis: Shop nutzt Stripe Hosted Checkout (Redirect), kein loadStripe/Elements. */
  checkoutMode: "hosted_redirect"
}

function keyMode(key: string, prefixLive: string, prefixTest: string): StripeEnvDiagnostics["secretKeyMode"] {
  if (!key) return "missing"
  if (key.startsWith(prefixLive)) return "live"
  if (key.startsWith(prefixTest)) return "test"
  return "unknown"
}

/** Sichere Diagnose ohne Key-Inhalte (für Admin/Checkout-Status). */
export function getStripeEnvDiagnostics(): StripeEnvDiagnostics {
  const secret = secretKeyRaw()
  const publishable = publishableKeyRaw()
  const secretKeyMode = keyMode(secret, "sk_live_", "sk_test_")
  const publishableKeyMode = keyMode(publishable, "pk_live_", "pk_test_")
  const configured = isStripeConfigured()
  const modeMismatch =
    configured &&
    publishableKeyMode !== "missing" &&
    secretKeyMode !== "unknown" &&
    publishableKeyMode !== "unknown" &&
    secretKeyMode !== publishableKeyMode

  return {
    configured,
    secretKeyPresent: Boolean(secret),
    secretKeyMode,
    publishableKeyPresent: Boolean(publishable),
    publishableKeyMode,
    modeMismatch,
    webhookSecretPresent: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    checkoutMode: "hosted_redirect",
  }
}

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error(
      "Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt oder ist ungültig)."
    )
  }
  if (!stripeClient) {
    // Trim: Azure App Settings können versehentlich Whitespace enthalten
    stripeClient = new Stripe(secretKeyRaw())
  }
  return stripeClient
}

/** Stripe-Fehler für API-Antworten lesbar machen (ohne sensible Details). */
export function formatStripeError(error: unknown): {
  message: string
  code?: string
  type?: string
} {
  if (error && typeof error === "object") {
    const e = error as {
      message?: string
      code?: string
      type?: string
      raw?: { message?: string; code?: string; type?: string }
    }
    const message =
      e.raw?.message ||
      e.message ||
      "Stripe-Anfrage fehlgeschlagen."
    return {
      message,
      code: e.raw?.code || e.code,
      type: e.raw?.type || e.type,
    }
  }
  if (error instanceof Error) return { message: error.message }
  return { message: "Stripe-Anfrage fehlgeschlagen." }
}

/**
 * Öffentliche Origin für Redirects / E-Mail-Links.
 * Nutzt NEXT_PUBLIC_SITE_URL / NEXTAUTH_URL — nie Request-Host (Docker).
 */
export function getSiteOrigin(_request?: Request): string {
  return resolveSiteOrigin()
}
