import QRCode from "qrcode"
import type { StoredOrder } from "@/lib/admin/types"
import {
  resolveKontoinhaber,
  type DocumentTemplateSettings,
} from "@/lib/documents/document-template-types"

export type SwissQrBillInput = {
  order: StoredOrder
  template: DocumentTemplateSettings
}

function parseCompanyAddress(firmenAdresse: string): {
  street: string
  zip: string
  city: string
} {
  const lines = firmenAdresse
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const street = lines[0] ?? ""
  const zipCity = lines[1] ?? ""
  const zipMatch = zipCity.match(/^(\d{4,5})\s+(.+)$/)
  if (zipMatch) {
    return { street, zip: zipMatch[1], city: zipMatch[2] }
  }
  return { street, zip: "", city: zipCity }
}

/** Swiss Payments Code (QR-Rechnung) Payload — Version 2.0, ohne strukturierte Referenz. */
export function buildSwissQrBillPayload({
  order,
  template,
}: SwissQrBillInput): string | null {
  const iban = template.iban.replace(/\s/g, "").toUpperCase()
  if (!iban.startsWith("CH") || iban.length < 15) return null

  const { street, zip, city } = parseCompanyAddress(template.firmenAdresse)
  const creditorName = resolveKontoinhaber(template)

  const billing = order.billing
  const debtorName = `${billing.firstName} ${billing.lastName}`.trim()

  const lines = [
    "SPC",
    "0200",
    "1",
    iban,
    "S",
    creditorName.slice(0, 70),
    street.slice(0, 70),
    "",
    zip.slice(0, 16),
    city.slice(0, 35),
    "CH",
    "",
    "",
    "",
    "",
    "",
    "",
    order.totals.total.toFixed(2),
    "CHF",
    "K",
    debtorName.slice(0, 70),
    billing.street.slice(0, 70),
    "",
    billing.zip.slice(0, 16),
    billing.city.slice(0, 35),
    (billing.country || "CH").slice(0, 2).toUpperCase(),
    "NON",
    "",
    `Rechnung ${order.orderId}`.slice(0, 140),
    "EPD",
  ]

  return lines.join("\n")
}

export async function createSwissQrBillDataUrl(
  input: SwissQrBillInput
): Promise<string | null> {
  const payload = buildSwissQrBillPayload(input)
  if (!payload) return null

  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: 280,
  })
}
