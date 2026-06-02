import { NextResponse } from "next/server"
import { getSettings, saveSettings } from "@/lib/admin/db"
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/admin/types"
import type { CheckoutRuntimeConfig } from "@/lib/dripforge/checkout-config"
import type { CompanySettings } from "@/lib/admin/types"

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.warn("Admin-API: Einstellungen konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Einstellungen konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      checkout?: CheckoutRuntimeConfig
      company?: Partial<CompanySettings>
    }

    if (!body.checkout) {
      return NextResponse.json(
        { error: "Checkout-Konfiguration fehlt." },
        { status: 400 }
      )
    }

    const checkout: CheckoutRuntimeConfig = {
      mwstAktiv: Boolean(body.checkout.mwstAktiv),
      mwstSatz: Number(body.checkout.mwstSatz) || 8.1,
      twintGatewayAktiv: Boolean(body.checkout.twintGatewayAktiv),
      twintTelefonnummer:
        body.checkout.twintTelefonnummer?.trim() || "+41 79 000 00 00",
    }

    const company: CompanySettings = {
      firmenname:
        body.company?.firmenname?.trim() ?? DEFAULT_COMPANY_SETTINGS.firmenname,
      firmenAdresse:
        body.company?.firmenAdresse?.trim() ??
        DEFAULT_COMPANY_SETTINGS.firmenAdresse,
      iban: body.company?.iban?.trim() ?? "",
      bankname: body.company?.bankname?.trim() ?? "",
      kontaktEmail:
        body.company?.kontaktEmail?.trim() ??
        DEFAULT_COMPANY_SETTINGS.kontaktEmail,
    }

    const settings = await saveSettings({ checkout, company })
    return NextResponse.json(settings)
  } catch (error) {
    console.warn("Admin-API: Einstellungen konnten nicht gespeichert werden.", error)
    return NextResponse.json(
      { error: "Einstellungen konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
