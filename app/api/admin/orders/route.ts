import { NextResponse } from "next/server"
import { getOrders } from "@/lib/admin/db"

export async function GET() {
  try {
    const orders = await getOrders()
    return NextResponse.json({ orders })
  } catch (error) {
    console.warn("Admin-API: Bestellungen konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Bestellungen konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}
