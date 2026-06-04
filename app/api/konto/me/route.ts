import { NextResponse } from "next/server"
import { getAccountByEmail, toPublicAccount } from "@/lib/konto/account-db"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"

export async function GET() {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  const account = await getAccountByEmail(email)
  if (!account) {
    return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 })
  }

  return NextResponse.json({ account: toPublicAccount(account) })
}
