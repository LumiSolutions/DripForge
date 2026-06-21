import { NextResponse } from "next/server"
import { getAccountByEmail } from "@/lib/konto/account-db"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { softDeleteCustomerAccount } from "@/lib/konto/delete-customer-account"
import {
  CUSTOMER_SESSION_COOKIE,
  customerSessionCookieOptions,
} from "@/lib/konto/session-node"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  try {
    const email = await getSessionEmailFromRequest()
    if (!email) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
    }

    const account = await getAccountByEmail(email)
    if (!account) {
      return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 })
    }

    await softDeleteCustomerAccount(account)

    const response = NextResponse.json({
      success: true,
      redirectUrl: "/",
    })

    response.cookies.set(CUSTOMER_SESSION_COOKIE, "", {
      ...customerSessionCookieOptions(),
      maxAge: 0,
    })

    return response
  } catch (error) {
    console.error("Konto: Löschung fehlgeschlagen.", error)
    const message =
      error instanceof Error ? error.message : "Konto konnte nicht gelöscht werden."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
