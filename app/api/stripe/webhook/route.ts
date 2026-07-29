import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Legacy-Pfad — delegiert an /api/webhooks/stripe */
export async function POST(request: NextRequest) {
  const { POST: handleStripeWebhook } = await import(
    "@/app/api/webhooks/stripe/route"
  )
  return handleStripeWebhook(request)
}
