import { resolveSiteOrigin } from "@/lib/site/site-origin"

/** Stripe Checkout Redirect-URLs (Produktion: dripforge.ch / www). */
export function getStripeCheckoutUrls(): {
  successUrl: string
  cancelUrl: string
} {
  const base = resolveSiteOrigin()

  return {
    successUrl: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/checkout/cancelled`,
  }
}
