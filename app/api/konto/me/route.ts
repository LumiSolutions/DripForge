import { NextResponse } from "next/server"
import {
  toPublicAccount,
  isActiveCustomerAccount,
} from "@/lib/konto/account-db"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { ensureAccountHasCustomerNumber } from "@/lib/konto/crm-sync"

export async function GET() {
  const email = await getSessionEmailFromRequest()
  if (!email) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 })
  }

  const account = await ensureAccountHasCustomerNumber(email)
  if (!account || !isActiveCustomerAccount(account)) {
    return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 })
  }

  return NextResponse.json({ account: toPublicAccount(account) })
}
