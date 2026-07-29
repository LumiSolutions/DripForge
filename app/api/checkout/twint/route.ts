import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { isStripeConfigured } from "@/lib/stripe/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * TWINT läuft über Stripe Checkout.
 * GET: Status — POST: gleiche Logik wie /api/checkout
 */
export async function GET() {
  return NextResponse.json({
    configured: isStripeConfigured(),
    provider: "stripe",
  })
}

/** @deprecated Nutze POST /api/checkout mit paymentMethod: "twint" */
export async function POST(request: NextRequest) {
  const { POST: handleCheckout } = await import("@/app/api/checkout/route")
  return handleCheckout(request)
}
