import { NextResponse } from "next/server"
import { getOrders } from "@/lib/admin/db"

export async function GET() {
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
