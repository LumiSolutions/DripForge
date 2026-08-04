import { randomUUID } from "crypto"
import type { CartItem } from "@/lib/dripforge/types"

export const CUSTOMER_OFFER_DOC_TYPE = "customer_offer" as const

export type CustomerOfferStatus = "active" | "accepted" | "expired" | "withdrawn"

export type CustomerOfferAttachment = {
  id: string
  fileName: string
  mimeType: string
  url: string
}

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
  /** Optionale Dateianhänge (Vorschau / STL / PDF) */
  attachments?: CustomerOfferAttachment[]
  createdAt: string
  updatedAt: string
  createdByAdmin?: string | null
}

function normalizeAttachments(
  raw: unknown
): CustomerOfferAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const next = raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const item = entry as Record<string, unknown>
      const url = typeof item.url === "string" ? item.url.trim() : ""
      const fileName =
        typeof item.fileName === "string" ? item.fileName.trim() : ""
      if (!url || !fileName) return null
      return {
        id:
          typeof item.id === "string" && item.id.trim()
            ? item.id.trim()
            : randomUUID(),
        fileName: fileName.slice(0, 240),
        mimeType:
          typeof item.mimeType === "string" && item.mimeType.trim()
            ? item.mimeType.trim()
            : "application/octet-stream",
        url,
      } satisfies CustomerOfferAttachment
    })
    .filter((entry): entry is CustomerOfferAttachment => Boolean(entry))
  return next.length > 0 ? next : undefined
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
    attachments: normalizeAttachments(raw.attachments),
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    createdByAdmin: raw.createdByAdmin ?? null,
  }
}
