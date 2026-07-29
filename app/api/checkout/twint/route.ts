import { NextResponse } from "next/server"
import { isStripeConfigured } from "@/lib/stripe/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * TWINT läuft über Stripe Checkout (`POST /api/checkout` mit paymentMethod=twint).
 * Diese Route bleibt als Status-Check (configured) und leitet POST an denselben Flow.
 */
export async function GET() {
  return NextResponse.json({
    configured: isStripeConfigured(),
    provider: "stripe",
  })
}

/** @deprecated Nutze POST /api/checkout mit paymentMethod: "twint" */
export { POST } from "@/app/api/checkout/route"
