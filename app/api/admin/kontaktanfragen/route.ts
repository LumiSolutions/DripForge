import { NextResponse } from "next/server"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { listKontaktanfragen } from "@/lib/admin/kontaktanfragen-db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const items = await listKontaktanfragen()
    return NextResponse.json({ items })
  } catch (error) {
    console.error("Admin kontaktanfragen list failed.", error)
    return NextResponse.json(
      { error: "Kontaktanfragen konnten nicht geladen werden.", items: [] },
      { status: 500 }
    )
  }
}
