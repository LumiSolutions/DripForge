import {
  applyOrderEmailPlaceholders,
  DEFAULT_ORDER_EMAIL_TEMPLATES,
  type OrderEmailTemplates,
} from "@/lib/email/order-email-templates"
import {
  renderOrderConfirmationEmailHtml,
  renderOrderItemsTableHtml,
  textToHtmlParagraphs,
} from "@/lib/email/dripforge-email-layout"
import type { OrderEmailLayout } from "@/lib/email/order-email-layout"
import { DRIPFORGE_LOGO_URL } from "@/lib/invoices/invoice-format"

const SAMPLE_PLACEHOLDERS = {
  customerName: "Max Muster",
  orderNumber: "RE-0042",
  totalAmount: "CHF 129.90",
}

const SAMPLE_ITEMS = [
  { name: "Lasergravur — Edelstahlflasche", quantity: 1, price: 49.9 },
  { name: "UV-Druck — Visitenkarten (50 Stk.)", quantity: 1, price: 65.0 },
]

/** Live-Vorschau der Kunden-Bestellbestätigung für den Admin-Editor. */
export function renderOrderEmailPreviewHtml(options: {
  templates: OrderEmailTemplates
  layout: OrderEmailLayout
  logoUrl?: string | null
}): string {
  const introRaw =
    options.templates.receivedIntro.trim() ||
    DEFAULT_ORDER_EMAIL_TEMPLATES.receivedIntro
  const footerRaw =
    options.templates.receivedFooter.trim() ||
    DEFAULT_ORDER_EMAIL_TEMPLATES.receivedFooter

  const introText = applyOrderEmailPlaceholders(introRaw, SAMPLE_PLACEHOLDERS)
  const footerText = applyOrderEmailPlaceholders(footerRaw, SAMPLE_PLACEHOLDERS)

  const orderItems =
    textToHtmlParagraphs(
      [
        `Rechnungsnummer: ${SAMPLE_PLACEHOLDERS.orderNumber}`,
        "Bestell-Ref: DF-SAMPLE-001",
        "Datum: 31.07.2026",
        "Zahlungsart: TWINT",
        "Zahlungsstatus: Bezahlt / bestätigt",
        "Versandart: Schweizer Post (A-Post)",
      ].join("\n")
    ) + renderOrderItemsTableHtml(SAMPLE_ITEMS)

  const totals = textToHtmlParagraphs(
    [
      "Zwischensumme: CHF 114.90",
      "Versand: CHF 7.00",
      "MwSt.: CHF 8.00",
      `Gesamtbetrag: ${SAMPLE_PLACEHOLDERS.totalAmount}`,
    ].join("\n")
  )

  const addressBlock = textToHtmlParagraphs(
    [
      "Rechnungsadresse:",
      "Max Muster",
      "Beispielstrasse 12",
      "8000 Zürich",
      "CH",
      "E-Mail: max.muster@example.com",
      "",
      "Lieferadresse:",
      "Max Muster",
      "Beispielstrasse 12",
      "8000 Zürich",
      "CH",
    ].join("\n")
  )

  return renderOrderConfirmationEmailHtml({
    layout: options.layout,
    title: "Bestellbestätigung",
    sections: {
      header: "",
      intro: textToHtmlParagraphs(introText),
      orderItems,
      totals,
      addressBlock,
      footer: textToHtmlParagraphs(footerText),
    },
    extraHtml: `<p style="margin:24px 0;text-align:center;">
      <a href="#" style="display:inline-block;padding:12px 24px;background:#ea580c;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;">Zu meinen Bestellungen</a>
    </p>`,
    footerLines: {
      line1: "DripForge",
      line2: "shop@dripforge.ch",
      line3: "Zürich, Schweiz",
    },
    logoUrl: options.logoUrl || DRIPFORGE_LOGO_URL,
  })
}
