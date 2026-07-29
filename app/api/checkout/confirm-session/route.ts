import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Alias → /api/orders/confirm-stripe */
export async function POST(request: NextRequest) {
  const { POST: confirmStripe } = await import(
    "@/app/api/orders/confirm-stripe/route"
  )
  return confirmStripe(request)
}
