import { NextResponse } from "next/server"
import { getCustomers } from "@/lib/admin/db"
import { toCustomerListItem } from "@/lib/admin/customers"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const customers = await getCustomers()
    return NextResponse.json({
      customers: customers.map(toCustomerListItem),
    })
  } catch (error) {
    console.error("Admin-API: Kunden konnten nicht geladen werden.", error)
    return NextResponse.json(
      { customers: [] },
      { headers: { "X-DripForge-Degraded": "1" } }
    )
  }
}
