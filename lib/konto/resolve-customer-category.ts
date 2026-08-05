/**
 * Löst die Kundenkategorie für eine Session-E-Mail auf.
 * Portal-Konto und CRM-Kunde können auseinanderlaufen — beide Quellen prüfen.
 */

import { getSettings } from "@/lib/admin/db"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { getCustomersSnapshot } from "@/lib/admin/customer-store"
import {
  findCustomerCategory,
  type CustomerCategory,
} from "@/lib/dripforge/customer-categories"
import { getAccountByEmail, saveAccount } from "@/lib/konto/account-db"

/**
 * Kategorie-ID aus Portal-Konto, sonst CRM-Stammdaten.
 * Heilt fehlende Portal-Zuordnung best-effort nach.
 */
export async function resolveCustomerCategoryForEmail(
  email: string | null | undefined
): Promise<CustomerCategory | null> {
  const normalized = typeof email === "string" ? normalizeCustomerEmail(email) : ""
  if (!normalized) return null

  const [account, settings, customers] = await Promise.all([
    getAccountByEmail(normalized),
    getSettings(),
    getCustomersSnapshot(),
  ])

  const crm = customers.find(
    (c) => normalizeCustomerEmail(c.email) === normalized
  )
  const categoryId =
    account?.customerCategoryId?.trim() ||
    crm?.customerCategoryId?.trim() ||
    null

  // Portal ohne Kategorie, CRM hat eine → Portal nachziehen (Anzeige + Checkout).
  if (
    account &&
    !account.customerCategoryId?.trim() &&
    crm?.customerCategoryId?.trim()
  ) {
    try {
      await saveAccount({
        ...account,
        customerCategoryId: crm.customerCategoryId.trim(),
      })
    } catch {
      console.warn(
        "Kundenkategorie: Portal-Konto konnte nicht nachgezogen werden."
      )
    }
  }

  return findCustomerCategory(settings.customerCategories, categoryId)
}
