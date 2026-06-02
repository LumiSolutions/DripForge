import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json(settings.company)
  } catch (error) {
    console.warn("Shop-API: Firmendaten nicht verfuegbar.", error)
    return NextResponse.json(
      { error: "Firmendaten nicht verfuegbar." },
      { status: 500 }
    )
  }
}
