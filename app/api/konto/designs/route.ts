import { NextResponse } from "next/server"
import { getDesignsForCustomer } from "@/lib/konto/designs-db"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"

export async function GET() {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  try {
    const designs = await getDesignsForCustomer(email)
    return NextResponse.json({ designs })
  } catch (error) {
    console.error("Konto: Designs konnten nicht geladen werden.", error)
    return NextResponse.json({ designs: [] })
  }
}
