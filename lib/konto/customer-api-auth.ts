import { NextResponse } from "next/server"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"

export async function requireCustomerSession(): Promise<
  { email: string } | NextResponse
> {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }
  return { email }
}

export function isCustomerAuthError(
  result: { email: string } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
