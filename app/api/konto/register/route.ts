import { NextResponse } from "next/server"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { getAccountByEmail, saveAccount, toPublicAccount } from "@/lib/konto/account-db"
import type { CustomerAccount } from "@/lib/konto/account-types"
import { DEFAULT_CUSTOMER_ACCOUNT_STATUS } from "@/lib/konto/account-status"
import { allocateNextCustomerNumber } from "@/lib/admin/customer-number-service"
import { mergeGuestCartForCustomer } from "@/lib/konto/cart-service"
import { syncAccountToCrm } from "@/lib/konto/crm-sync"
import { hashPassword } from "@/lib/konto/password"
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
      firstName?: string
      lastName?: string
      guestCart?: unknown
    }

    const email = normalizeCustomerEmail(body.email ?? "")
    const password = body.password ?? ""
    const firstName = body.firstName?.trim() ?? ""
    const lastName = body.lastName?.trim() ?? ""

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Bitte eine gültige E-Mail eingeben." },
        { status: 400 }
      )
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Passwort muss mindestens 8 Zeichen haben." },
        { status: 400 }
      )
    }
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "Vor- und Nachname sind Pflichtfelder." },
        { status: 400 }
      )
    }

    const existing = await getAccountByEmail(email)
    if (existing) {
      return NextResponse.json(
        { error: "Diese E-Mail ist bereits registriert." },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()
    const kundennummer = await allocateNextCustomerNumber()
    const account: CustomerAccount = {
      id: email,
      email,
      passwordHash: hashPassword(password),
      firstName,
      lastName,
      kundennummer,
      status: DEFAULT_CUSTOMER_ACCOUNT_STATUS,
      loyaltyPoints: 0,
      createdAt: now,
      updatedAt: now,
    }

    await saveAccount(account)
    const synced = await syncAccountToCrm(account)
    const mergedCart = await mergeGuestCartForCustomer(email, body.guestCart)

    const response = NextResponse.json({
      success: true,
      account: toPublicAccount(synced),
      cart: mergedCart,
    })

    response.cookies.set(
      CUSTOMER_SESSION_COOKIE,
      createCustomerSessionToken(email),
      customerSessionCookieOptions()
    )

    return response
  } catch (error) {
    console.error("Konto: Registrierung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Registrierung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
