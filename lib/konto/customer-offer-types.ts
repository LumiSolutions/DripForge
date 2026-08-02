import { randomUUID } from "crypto"
import type { CartItem } from "@/lib/dripforge/types"

export const CUSTOMER_OFFER_DOC_TYPE = "customer_offer" as const

export type CustomerOfferStatus = "active" | "accepted" | "expired" | "withdrawn"

/** Admin-vorbereitetes Angebot / Entwurf für einen Kundenaccount. */
export type CustomerOffer = {
  id: string
  docType: typeof CUSTOMER_OFFER_DOC_TYPE
  /** Normalisierte Kunden-E-Mail (Konto-Login) */
  customerEmail: string
  /** Optional Kundennummer aus Admin-CRM */
  customerId?: string | null
  title: string
  description?: string
  previewUrl?: string | null
  /** Preis-Hinweis in CHF (für Anzeige; CartItem.price ist massgebend) */
  priceChf?: number | null
  /** Fertiger Warenkorb-Eintrag, den der Kunde übernehmen kann */
  cartItem: CartItem
  status: CustomerOfferStatus
  createdAt: string
  updatedAt: string
  createdByAdmin?: string | null
}

export function normalizeCustomerOffer(
  raw: Partial<CustomerOffer> & { customerEmail?: string }
): CustomerOffer | null {
  const email = String(raw.customerEmail ?? "")
    .trim()
    .toLowerCase()
  if (!email || !raw.cartItem || typeof raw.cartItem !== "object") return null

  const cart = raw.cartItem as CartItem
  if (!cart.name || !Number.isFinite(Number(cart.price))) return null

  const now = new Date().toISOString()
  const status: CustomerOfferStatus =
    raw.status === "accepted" ||
    raw.status === "expired" ||
    raw.status === "withdrawn"
      ? raw.status
      : "active"

  return {
    id: raw.id?.trim() || randomUUID(),
    docType: CUSTOMER_OFFER_DOC_TYPE,
    customerEmail: email,
    customerId: raw.customerId ?? null,
    title: String(raw.title ?? cart.name).trim().slice(0, 160) || cart.name,
    description:
      typeof raw.description === "string"
        ? raw.description.trim().slice(0, 2000)
        : undefined,
    previewUrl:
      typeof raw.previewUrl === "string" ? raw.previewUrl.trim() || null : null,
    priceChf:
      raw.priceChf != null && Number.isFinite(Number(raw.priceChf))
        ? Number(raw.priceChf)
        : Number(cart.price) || null,
    cartItem: {
      ...cart,
      id: cart.id || `offer-${randomUUID()}`,
      quantity: Math.max(1, Number(cart.quantity) || 1),
      type: cart.type === "laser" ? "laser" : "3d",
      price: Math.max(0, Number(cart.price) || 0),
    },
    status,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    createdByAdmin: raw.createdByAdmin ?? null,
  }
}
