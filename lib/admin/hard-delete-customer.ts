import { getCustomerByNumber } from "@/lib/admin/db"
import { deleteCustomerByNumber } from "@/lib/admin/customer-store"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { deleteAccountById, listAllAccounts } from "@/lib/konto/account-db"

export class HardDeleteCustomerError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "HardDeleteCustomerError"
  }
}

export async function hardDeleteCustomer(kundennummer: string): Promise<void> {
  const trimmed = kundennummer.trim()
  if (!trimmed) {
    throw new HardDeleteCustomerError("Kundennummer fehlt.", 400)
  }

  const customer = await getCustomerByNumber(trimmed)
  if (!customer) {
    throw new HardDeleteCustomerError("Kunde nicht gefunden.", 404)
  }

  if (customer.orderIds.length > 0) {
    throw new HardDeleteCustomerError(
      "Kunde hat bereits Bestellungen und kann wegen der Buchhaltungspflicht nur vom Kunden selbst anonymisiert werden.",
      409
    )
  }

  const accounts = await listAllAccounts()
  const portalAccount =
    accounts.find((account) => account.kundennummer === trimmed) ??
    accounts.find(
      (account) =>
        normalizeCustomerEmail(account.id) ===
        normalizeCustomerEmail(customer.email)
    )

  if (portalAccount) {
    await deleteAccountById(portalAccount.id)
  }

  const deleted = await deleteCustomerByNumber(trimmed)
  if (!deleted && !portalAccount) {
    throw new HardDeleteCustomerError("Kunde nicht gefunden.", 404)
  }
}
