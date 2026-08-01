import { NextResponse } from "next/server"
import {
  getStripeEnvDiagnostics,
  getStripePublishableKey,
} from "@/lib/stripe/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Liefert den Stripe Publishable Key zur Laufzeit (nicht Build-Zeit).
 * pk_* ist öffentlich — sicher fürs Frontend.
 */
export async function GET() {
  const publishableKey = getStripePublishableKey() || null
  const diagnostics = getStripeEnvDiagnostics()

  return NextResponse.json(
    {
      publishableKey,
      configured: diagnostics.configured,
      diagnostics: {
        publishableKeyPresent: diagnostics.publishableKeyPresent,
        publishableKeyMode: diagnostics.publishableKeyMode,
        secretKeyMode: diagnostics.secretKeyMode,
        modeMismatch: diagnostics.modeMismatch,
        checkoutMode: diagnostics.checkoutMode,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  )
}
