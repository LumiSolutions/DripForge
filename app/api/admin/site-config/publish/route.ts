import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import { getSiteConfigMeta, publishSiteConfig } from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const texts = await publishSiteConfig()
    const meta = await getSiteConfigMeta()
    return NextResponse.json({
      texts,
      meta,
      environment: "production",
      message: "Staging-Texte wurden live veröffentlicht.",
    })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Site-Config: Veröffentlichen fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Texte konnten nicht veröffentlicht werden." },
      { status: 500 }
    )
  }
}
