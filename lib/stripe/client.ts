import Stripe from "stripe"
import { resolveSiteOrigin } from "@/lib/site/site-origin"

let stripeClient: Stripe | null = null

export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? ""
  if (!key) return false
  if (key.includes("placeholder") || key.includes("sk_test_xxx")) return false
  return true
}

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error(
      "Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt oder ist ungültig)."
    )
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return stripeClient
}

/**
 * Öffentliche Origin für Redirects / E-Mail-Links.
 * Nutzt NEXT_PUBLIC_SITE_URL / NEXTAUTH_URL — nie Request-Host (Docker).
 */
export function getSiteOrigin(_request?: Request): string {
  return resolveSiteOrigin()
}
