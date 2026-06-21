import { NextResponse } from "next/server"
import {
  HardDeleteCustomerError,
  hardDeleteCustomer,
} from "@/lib/admin/hard-delete-customer"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json()) as { userId?: unknown }
    const userId = typeof body.userId === "string" ? body.userId.trim() : ""
    if (!userId) {
      return NextResponse.json({ error: "userId fehlt." }, { status: 400 })
    }

    await hardDeleteCustomer(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof HardDeleteCustomerError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Admin-API: Hard-Delete fehlgeschlagen.", error)
    const message =
      error instanceof Error ? error.message : "Kunde konnte nicht gelöscht werden."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
