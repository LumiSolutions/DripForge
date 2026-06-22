import { NextResponse } from "next/server"
import {
  getCustomerProfile,
  parseCustomerAddressInput,
  updateCustomerAddress,
} from "@/lib/konto/customer-profile-service"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"

export async function PATCH(request: Request) {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  const input = parseCustomerAddressInput(await request.json().catch(() => null))
  if (!input) {
    return NextResponse.json({ error: "Ungültige Adressdaten." }, { status: 400 })
  }

  const profile = await updateCustomerAddress(email, input)
  if (!profile) {
    return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 })
  }

  return NextResponse.json({ account: profile })
}

export async function PUT(request: Request) {
  return PATCH(request)
}
