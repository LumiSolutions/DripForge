import { resolveSiteOrigin } from "@/lib/site/site-origin"

/** Stripe Checkout Redirect-URLs nach erfolgreicher / abgebrochener Zahlung. */
export function getStripeCheckoutUrls(): {
  successUrl: string
  cancelUrl: string
} {
  const base = resolveSiteOrigin()

  return {
    successUrl: `${base}/bestellung/erfolg?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/bestellung/abgebrochen`,
  }
}
