import { NextResponse } from "next/server"
import {
  getIndividualPricingSettings,
  saveIndividualPricingSettings,
} from "@/lib/admin/individual-pricing-db"
import {
  sanitizeIndividualPricingSettings,
  type IndividualPricingSettings,
} from "@/lib/admin/individual-pricing-types"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const settings = await getIndividualPricingSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error("Admin Individual-Pricing GET fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Preiskategorien konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json()) as Partial<IndividualPricingSettings>
    const saved = await saveIndividualPricingSettings(
      sanitizeIndividualPricingSettings(body)
    )
    return NextResponse.json(saved)
  } catch (error) {
    console.error("Admin Individual-Pricing PUT fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Preiskategorien konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
