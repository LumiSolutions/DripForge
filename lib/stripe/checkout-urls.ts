/** Stripe Checkout Redirect-URLs (Produktion: www.dripforge.ch). */
export function getStripeCheckoutUrls(): {
  successUrl: string
  cancelUrl: string
} {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, "") ||
    "https://www.dripforge.ch"

  return {
    successUrl: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/checkout/cancelled`,
  }
}
