import { NextResponse } from "next/server"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { updateKontaktanfrageStatus } from "@/lib/admin/kontaktanfragen-db"
import {
  KONTAKT_STATUS_VALUES,
  type KontaktStatus,
} from "@/lib/admin/kontaktanfrage-types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    if (!id?.trim()) {
      return NextResponse.json({ error: "ID fehlt." }, { status: 400 })
    }
    const body = (await request.json()) as { status?: string }
    if (
      !body.status ||
      !KONTAKT_STATUS_VALUES.includes(body.status as KontaktStatus)
    ) {
      return NextResponse.json(
        { error: "Ungültiger Status." },
        { status: 400 }
      )
    }
    const updated = await updateKontaktanfrageStatus(
      id.trim(),
      body.status as KontaktStatus
    )
    if (!updated) {
      return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Admin kontaktanfrage update failed.", error)
    return NextResponse.json(
      { error: "Status konnte nicht aktualisiert werden." },
      { status: 500 }
    )
  }
}
