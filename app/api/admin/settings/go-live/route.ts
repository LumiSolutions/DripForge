import { NextResponse } from "next/server"
import { setShopLive } from "@/lib/admin/db"

export async function POST() {
  try {
    const settings = await setShopLive(true)
    return NextResponse.json({
      success: true,
      launch: settings.launch,
      message: "Website ist jetzt offiziell live.",
    })
  } catch (error) {
    console.warn("Admin-API: Live-Schaltung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Live-Schaltung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
