import { NextResponse } from "next/server"
import { getOrders } from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const orders = await getOrders()
    return NextResponse.json({ orders })
  } catch (error) {
    console.error("Admin-API: Bestellungen konnten nicht geladen werden.", error)
    return NextResponse.json(
      { orders: [] },
      { headers: { "X-DripForge-Degraded": "1" } }
    )
  }
}
