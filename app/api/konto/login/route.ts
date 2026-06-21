import { NextResponse } from "next/server"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { getAccountByEmail, toPublicAccount, isActiveCustomerAccount } from "@/lib/konto/account-db"
import { mergeGuestCartForCustomer } from "@/lib/konto/cart-service"
import { verifyPassword } from "@/lib/konto/password"
import {
  createCustomerSessionToken,
  customerSessionCookieOptions,
  CUSTOMER_SESSION_COOKIE,
} from "@/lib/konto/session-node"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string
      password?: string
      guestCart?: unknown
    }

    const email = normalizeCustomerEmail(body.email ?? "")
    const password = body.password ?? ""

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-Mail und Passwort erforderlich." },
        { status: 400 }
      )
    }

    const account = await getAccountByEmail(email)
    if (
      !account ||
      !isActiveCustomerAccount(account) ||
      !verifyPassword(password, account.passwordHash)
    ) {
      return NextResponse.json(
        { error: "E-Mail oder Passwort ist falsch." },
        { status: 401 }
      )
    }

    const mergedCart = await mergeGuestCartForCustomer(email, body.guestCart)

    const response = NextResponse.json({
      success: true,
      account: toPublicAccount(account),
      cart: mergedCart,
    })

    response.cookies.set(
      CUSTOMER_SESSION_COOKIE,
      createCustomerSessionToken(email),
      customerSessionCookieOptions()
    )

    return response
  } catch (error) {
    console.error("Konto: Login fehlgeschlagen.", error)
    return NextResponse.json({ error: "Login fehlgeschlagen." }, { status: 500 })
  }
}
