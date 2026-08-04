import { NextResponse } from "next/server"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { listAllCustomerOffers } from "@/lib/konto/offers-db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Listet alle vorbereiteten Kunden-Angebote / Entwürfe (für Belege → Offerten). */
export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const offers = await listAllCustomerOffers()
    const sorted = [...offers].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    return NextResponse.json({ offers: sorted })
  } catch (error) {
    console.warn("Admin-API: Kunden-Angebote konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Angebote konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}
