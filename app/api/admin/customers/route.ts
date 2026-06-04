import { NextResponse } from "next/server"
import { getCustomers } from "@/lib/admin/db"
import { toCustomerListItem } from "@/lib/admin/customers"

export async function GET() {
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
