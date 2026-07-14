import type { StoredOrder } from "@/lib/admin/types"
import type { Beleg } from "@/lib/documents/beleg-types"
import { roundChf } from "@/lib/documents/beleg-types"

/** Baut ein StoredOrder-ähnliches Objekt für die bestehende PDF-Pipeline. */
export function belegToSyntheticOrder(beleg: Beleg): StoredOrder {
  const hidePrices = beleg.type === "lieferschein"
  const items = beleg.positionen.map((pos) => ({
    id: pos.id,
    name: pos.name,
    price: hidePrices ? 0 : pos.unitPrice,
    quantity: pos.quantity,
    type: "3d" as const,
    customDetails: pos.details
      ? {
          variant: pos.details,
        }
      : undefined,
  }))

  const subtotal = hidePrices ? 0 : beleg.subtotal
  const vat = hidePrices ? 0 : beleg.vatTotal
  const total = hidePrices ? 0 : beleg.total
  const mwstAktiv = !hidePrices && vat > 0

  return {
    orderId: beleg.id,
    createdAt: beleg.createdAt,
    status: "ausstehend",
    billing: {
      firstName: beleg.kunde.firstName,
      lastName: beleg.kunde.lastName,
      email: beleg.kunde.email,
      street: beleg.kunde.street,
      zip: beleg.kunde.zip,
      city: beleg.kunde.city,
      country: beleg.kunde.country || "CH",
      phone: "",
    },
    delivery: beleg.lieferAdresse
      ? {
          firstName: beleg.lieferAdresse.firstName,
          lastName: beleg.lieferAdresse.lastName,
          email: beleg.lieferAdresse.email || beleg.kunde.email,
          street: beleg.lieferAdresse.street,
          zip: beleg.lieferAdresse.zip,
          city: beleg.lieferAdresse.city,
          country: beleg.lieferAdresse.country || "CH",
          phone: "",
        }
      : undefined,
    shippingMethod: "apost",
    paymentMethod: beleg.status === "bezahlt" ? "card" : "invoice",
    paymentMethodLabel: beleg.status === "bezahlt" ? "Online-Zahlung" : "Rechnung",
    paymentConfirmed: beleg.status === "bezahlt",
    items,
    totals: {
      subtotal: roundChf(subtotal),
      shippingCost: 0,
      discountAmount: 0,
      vat: roundChf(vat),
      total: roundChf(total),
      mwstAktiv,
    },
    rechnungPdfUrl: beleg.pdfUrl ?? undefined,
  }
}
