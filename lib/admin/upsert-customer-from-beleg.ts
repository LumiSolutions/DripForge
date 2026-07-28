import type { BelegAddress } from "@/lib/documents/beleg-types"
import {
  normalizeCustomerEmail,
} from "@/lib/admin/customers"
import { allocateNextCustomerNumber } from "@/lib/admin/customer-number-service"
import { saveCustomer } from "@/lib/admin/customer-store"
import {
  cosmosGetCustomerByEmail,
  cosmosGetCustomerByNumber,
} from "@/lib/admin/cosmos-store"
import type { OrderAddress } from "@/lib/dripforge/submit-order"
import type { StoredCustomer } from "@/lib/admin/types"

function belegAddressToBilling(address: BelegAddress, email: string): OrderAddress {
  return {
    firstName: address.firstName.trim(),
    lastName: address.lastName.trim(),
    street: address.street.trim(),
    zip: address.zip.trim(),
    city: address.city.trim(),
    country: String(address.country ?? "CH").trim() || "CH",
    email,
    phone: "",
  }
}

/**
 * Legt bei Bedarf einen CRM-Kunden an oder aktualisiert die Adresse
 * anhand der Beleg-Kundendaten (Match über E-Mail).
 * Ohne E-Mail: kein Upsert.
 */
export async function upsertCustomerFromBelegAddress(
  address: BelegAddress,
  preferredKundennummer?: string | null
): Promise<string | null> {
  const email = normalizeCustomerEmail(address.email)
  if (!email) return preferredKundennummer?.trim() || null

  const billing = belegAddressToBilling(address, email)

  let existing: StoredCustomer | null = await cosmosGetCustomerByEmail(email)
  if (!existing && preferredKundennummer?.trim()) {
    existing = await cosmosGetCustomerByNumber(preferredKundennummer.trim())
  }

  const now = new Date().toISOString()

  if (existing) {
    if (existing.status === "gelöscht") {
      return existing.kundennummer
    }
    const updated = await saveCustomer({
      ...existing,
      email,
      billing: {
        ...existing.billing,
        ...billing,
        phone: existing.billing.phone || "",
      },
      updatedAt: now,
    })
    return updated.kundennummer
  }

  const kundennummer = await allocateNextCustomerNumber()
  const created = await saveCustomer({
    kundennummer,
    email,
    billing,
    orderIds: [],
    createdAt: now,
    updatedAt: now,
  })
  return created.kundennummer
}
