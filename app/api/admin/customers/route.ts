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
    console.warn("Admin-API: Kunden konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Kunden konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}
