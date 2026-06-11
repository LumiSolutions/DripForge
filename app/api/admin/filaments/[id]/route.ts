import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import {
  deleteFilament,
  getAdminFilamentById,
  upsertFilament,
} from "@/lib/admin/db"
import { normalizeAdminFilament } from "@/lib/admin/filament-types"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import type { AdminFilament } from "@/lib/admin/filament-types"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const { id } = await context.params
    const filament = await getAdminFilamentById(id)
    if (!filament) {
      return NextResponse.json({ error: "Filament nicht gefunden." }, { status: 404 })
    }
    return NextResponse.json({ filament })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    return NextResponse.json(
      { error: "Filament konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const { id } = await context.params
    const existing = await getAdminFilamentById(id)
    if (!existing) {
      return NextResponse.json({ error: "Filament nicht gefunden." }, { status: 404 })
    }

    const body = (await request.json()) as Partial<AdminFilament>
    const filament = normalizeAdminFilament({ ...body, id }, existing)
    const saved = await upsertFilament(filament)
    return NextResponse.json({ filament: saved })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    return NextResponse.json(
      { error: "Filament konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const { id } = await context.params
    const ok = await deleteFilament(id)
    if (!ok) {
      return NextResponse.json({ error: "Filament nicht gefunden." }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    return NextResponse.json(
      { error: "Filament konnte nicht geloescht werden." },
      { status: 500 }
    )
  }
}
