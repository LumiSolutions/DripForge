import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import { getAdminFilaments, upsertFilament } from "@/lib/admin/db"
import type { AdminFilament } from "@/lib/admin/filament-types"
import { normalizeAdminFilament } from "@/lib/admin/filament-types"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const filaments = await getAdminFilaments()
    return NextResponse.json({ filaments })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Filaments: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Filamente konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as Partial<AdminFilament>
    const filament = normalizeAdminFilament(body)
    const saved = await upsertFilament(filament)
    return NextResponse.json({ filament: saved }, { status: 201 })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Filaments: Anlegen fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Filament konnte nicht angelegt werden." },
      { status: 500 }
    )
  }
}
