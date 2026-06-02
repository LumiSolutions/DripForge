import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json(settings.checkout)
  } catch (error) {
    console.warn("Shop-API: Checkout-Einstellungen nicht verfuegbar.", error)
    return NextResponse.json(
      { error: "Checkout-Einstellungen nicht verfuegbar." },
      { status: 500 }
    )
  }
}
