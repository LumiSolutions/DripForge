import { NextResponse } from "next/server"
import { getCustomers } from "@/lib/admin/db"
import { normalizeCustomerEmail, toCustomerListItem } from "@/lib/admin/customers"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { CosmosDatabaseError } from "@/lib/admin/storage-bridge"
import { listAllAccounts } from "@/lib/konto/account-db"
import { normalizeAccountStatus } from "@/lib/konto/account-status"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const [customers, accounts] = await Promise.all([
      getCustomers(),
      listAllAccounts(),
    ])

    const statusByKundennummer = new Map<string, ReturnType<typeof normalizeAccountStatus>>()
    const statusByEmail = new Map<string, ReturnType<typeof normalizeAccountStatus>>()

    for (const account of accounts) {
      const status = normalizeAccountStatus(account.status)
      if (account.kundennummer) {
        statusByKundennummer.set(account.kundennummer, status)
      }
      statusByEmail.set(account.id, status)
    }

    return NextResponse.json({
      customers: customers.map((customer) => {
        const item = toCustomerListItem(customer)
        const crmStatus = normalizeAccountStatus(customer.status)
        const portalStatus =
          statusByKundennummer.get(customer.kundennummer) ??
          statusByEmail.get(normalizeCustomerEmail(customer.email))
        const mergedStatus =
          crmStatus === "gelöscht" || crmStatus === "inaktiv"
            ? crmStatus
            : portalStatus ?? item.status
        return { ...item, status: mergedStatus }
      }),
    })
  } catch (error) {
    console.error("Admin-API: Kunden konnten nicht geladen werden.", error)
    if (error instanceof CosmosDatabaseError) {
      return NextResponse.json(
        { error: "Kundendatenbank nicht erreichbar.", customers: [] },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { customers: [] },
      { headers: { "X-DripForge-Degraded": "1" } }
    )
  }
}
