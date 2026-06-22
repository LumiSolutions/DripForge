import { NextResponse } from "next/server"
import {
  getCustomerProfile,
  parseCustomerAddressInput,
  updateCustomerAddress,
} from "@/lib/konto/customer-profile-service"
import {
  isCustomerAuthError,
  requireCustomerSession,
} from "@/lib/konto/customer-api-auth"

export async function GET() {
  const auth = await requireCustomerSession()
  if (isCustomerAuthError(auth)) return auth

  const profile = await getCustomerProfile(auth.email)
  if (!profile) {
    return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 })
  }

  return NextResponse.json({ profile })
}

export async function PUT(request: Request) {
  const auth = await requireCustomerSession()
  if (isCustomerAuthError(auth)) return auth

  const input = parseCustomerAddressInput(await request.json().catch(() => null))
  if (!input) {
    return NextResponse.json(
      { error: "Ungültige Adressdaten." },
      { status: 400 }
    )
  }

  const profile = await updateCustomerAddress(auth.email, input)
  if (!profile) {
    return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 })
  }

  return NextResponse.json({ profile })
}

/** Legacy-Kompatibilität für bestehende Clients */
export async function PATCH(request: Request) {
  return PUT(request)
}
