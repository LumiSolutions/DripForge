import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import { getSiteConfigStaging } from "@/lib/admin/db"
import {
  isAuthError,
  requireStaffTwoFactorSession,
} from "@/lib/admin/require-admin-session"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

/**
 * Staging site-config für Admin- und Tester-Sessions (Vorschau).
 * Schreibzugriff bleibt über /api/admin/site-config (nur Admin).
 */
export async function GET(request: Request) {
  const auth = requireStaffTwoFactorSession(request, ["admin", "tester"])
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const bundle = await getSiteConfigStaging()
    return NextResponse.json(
      {
        texts: bundle.texts,
        images: bundle.images,
        links: bundle.links,
        navItems: bundle.navItems,
        pages: bundle.pages,
        preview: true,
        role: auth.role,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Preview Site-Config: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Staging-Inhalte konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}
