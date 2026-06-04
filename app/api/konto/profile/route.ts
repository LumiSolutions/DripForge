import { NextResponse } from "next/server"
import { getAccountByEmail, saveAccount, toPublicAccount } from "@/lib/konto/account-db"
import type { CustomerProfileInput } from "@/lib/konto/account-types"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { syncAccountToCrm } from "@/lib/konto/crm-sync"

function parseProfile(body: unknown): CustomerProfileInput | null {
  if (!body || typeof body !== "object") return null
  const b = body as Record<string, unknown>
  const firstName = typeof b.firstName === "string" ? b.firstName.trim() : ""
  const lastName = typeof b.lastName === "string" ? b.lastName.trim() : ""
  const street = typeof b.street === "string" ? b.street.trim() : ""
  const zip = typeof b.zip === "string" ? b.zip.trim() : ""
  const city = typeof b.city === "string" ? b.city.trim() : ""
  const phone = typeof b.phone === "string" ? b.phone.trim() : ""

  if (!firstName || !lastName) return null
  return { firstName, lastName, street, zip, city, phone }
}

export async function PATCH(request: Request) {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  const profile = parseProfile(await request.json().catch(() => null))
  if (!profile) {
    return NextResponse.json(
      { error: "Vor- und Nachname sind Pflichtfelder." },
      { status: 400 }
    )
  }

  const account = await getAccountByEmail(email)
  if (!account) {
    return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 })
  }

  const saved = await saveAccount({
    ...account,
    ...profile,
  })
  const synced = await syncAccountToCrm(saved)

  return NextResponse.json({ account: toPublicAccount(synced) })
}
