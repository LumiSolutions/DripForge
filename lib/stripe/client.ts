import Stripe from "stripe"

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

export function getSiteOrigin(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, "")
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const proto = request.headers.get("x-forwarded-proto") ?? "https"
  if (host) return `${proto}://${host}`
  return "http://localhost:3000"
}
