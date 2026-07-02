import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { SHIPPING_OPTIONS } from "@/lib/dripforge/checkout-config"
import { formatChf, formatInvoiceDate } from "@/lib/invoices/invoice-format"
import {
  formatInvoiceItemDetails,
  getInvoiceLineTotal,
} from "@/lib/invoices/invoice-item-details"
import {
  applyInvoiceTemplatePlaceholders,
  type InvoiceTemplateSettings,
} from "@/lib/invoices/invoice-template-types"

const MM = 2.834645669

const anthracite = "#1f2937"
const anthraciteMid = "#374151"
const anthraciteLight = "#6b7280"
const orange = "#f97316"
const orangeSoft = "#fff7ed"
const border = "#e5e7eb"
const bgMuted = "#f8fafc"
const tableHeader = "#1e293b"

/** Schweizer Fensterkuvert: Empfaenger links, Datum rechts — Positionen in pt */
const ENVELOPE_LEFT = 20 * MM
const ENVELOPE_WINDOW_TOP = 45 * MM
const ENVELOPE_RETURN_TOP = 22 * MM
const ENVELOPE_WIDTH = 90 * MM

const PAYMENT_BLOCK_HEIGHT = 105 * MM

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: anthracite,
    lineHeight: 1.4,
    paddingBottom: PAYMENT_BLOCK_HEIGHT + 36,
  },
  returnAddress: {
    position: "absolute",
    top: ENVELOPE_RETURN_TOP,
    left: ENVELOPE_LEFT,
    width: ENVELOPE_WIDTH,
    fontSize: 7,
    color: anthraciteLight,
    lineHeight: 1.3,
  },
  logoWrap: {
    position: "absolute",
    top: 20 * MM,
    right: 20 * MM,
    width: 22 * MM,
    height: 22 * MM,
  },
  logo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  recipientBlock: {
    position: "absolute",
    top: ENVELOPE_WINDOW_TOP,
    left: ENVELOPE_LEFT,
    width: ENVELOPE_WIDTH,
    fontSize: 10,
    lineHeight: 1.45,
  },
  recipientLine: {
    marginBottom: 1,
  },
  dateBlock: {
    position: "absolute",
    top: ENVELOPE_WINDOW_TOP,
    right: 20 * MM,
    width: 55 * MM,
    textAlign: "right",
    fontSize: 9,
    color: anthraciteMid,
  },
  dateLabel: {
    fontSize: 7.5,
    color: anthraciteLight,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  dateValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: anthracite,
  },
  body: {
    marginTop: 92 * MM,
    paddingHorizontal: 20 * MM,
  },
  headerRule: {
    height: 1,
    backgroundColor: border,
    marginBottom: 14,
  },
  headerAccent: {
    height: 2,
    width: 48,
    backgroundColor: orange,
    marginBottom: 12,
  },
  headerInvoiceLine: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: anthracite,
    marginBottom: 4,
  },
  headerReferenceLine: {
    fontSize: 9.5,
    color: anthraciteMid,
    marginBottom: 8,
  },
  introText: {
    fontSize: 9.5,
    color: anthraciteLight,
    marginBottom: 18,
    maxWidth: "85%",
  },
  table: {
    borderWidth: 1,
    borderColor: border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: tableHeader,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  th: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  tableRowAlt: {
    backgroundColor: bgMuted,
  },
  colProduct: { width: "24%" },
  colDetails: { width: "36%" },
  colQty: { width: "8%", textAlign: "center" },
  colUnit: { width: "16%", textAlign: "right" },
  colTotal: { width: "16%", textAlign: "right" },
  cellProduct: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: anthracite,
  },
  cellDetails: {
    fontSize: 7.5,
    color: anthraciteLight,
    lineHeight: 1.35,
  },
  cellQty: {
    fontSize: 8.5,
    textAlign: "center",
    color: anthraciteMid,
  },
  cellMoney: {
    fontSize: 8.5,
    textAlign: "right",
    color: anthraciteMid,
  },
  cellMoneyBold: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    textAlign: "right",
    color: anthracite,
  },
  totalsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  totalsBox: {
    width: "42%",
    minWidth: 180,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 3,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
    fontSize: 8.5,
  },
  totalLabel: {
    color: anthraciteLight,
  },
  totalGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: orange,
  },
  totalGrandLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: anthracite,
  },
  totalGrandValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: anthracite,
  },
  vatNote: {
    marginTop: 6,
    fontSize: 7.5,
    color: anthraciteLight,
    fontStyle: "italic",
    textAlign: "right",
  },
  paymentBlock: {
    position: "absolute",
    bottom: 22,
    left: 0,
    right: 0,
    height: PAYMENT_BLOCK_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: anthracite,
    flexDirection: "row",
    paddingTop: 10,
    paddingHorizontal: 20 * MM,
    backgroundColor: orangeSoft,
  },
  paymentLeft: {
    flex: 1,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: border,
    justifyContent: "flex-start",
  },
  paymentSectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: orange,
    marginBottom: 8,
  },
  paymentLine: {
    fontSize: 8.5,
    marginBottom: 3,
    color: anthraciteMid,
  },
  paymentLineBold: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: anthracite,
    marginBottom: 4,
  },
  paymentAmount: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: anthracite,
    marginTop: 6,
    marginBottom: 8,
  },
  paymentNote: {
    fontSize: 7.5,
    color: anthraciteLight,
    lineHeight: 1.35,
    marginTop: 4,
  },
  paymentRight: {
    width: 52 * MM,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 10,
  },
  qrImage: {
    width: 46 * MM,
    height: 46 * MM,
  },
  qrLabel: {
    fontSize: 6.5,
    color: anthraciteLight,
    marginTop: 4,
    textAlign: "center",
  },
  centerFooter: {
    position: "absolute",
    bottom: 6,
    left: 20 * MM,
    right: 20 * MM,
    textAlign: "center",
    fontSize: 7,
    color: anthraciteLight,
  },
})

export type InvoiceDocumentProps = {
  order: StoredOrder
  settings: AdminSettings
  template: InvoiceTemplateSettings
  qrDataUrl?: string | null
}

function shippingLabel(method: StoredOrder["shippingMethod"]): string {
  return SHIPPING_OPTIONS.find((o) => o.id === method)?.label ?? method
}

function buildReturnAddress(template: InvoiceTemplateSettings): string {
  const lines = template.firmenAdresse.split("\n").filter(Boolean)
  const cityLine = lines.slice(1).join(", ") || lines[0] || ""
  return `${template.firmenname} · ${cityLine}`.trim()
}

export function InvoiceDocument({
  order,
  settings,
  template,
  qrDataUrl,
}: InvoiceDocumentProps) {
  const { checkout } = settings
  const mwstSatz = checkout.mwstSatz
  const paymentTermsDays = template.paymentTermsDays
  const logoUrl = template.logoUrl ?? undefined

  const placeholderValues = {
    firmenname: template.firmenname,
    inhaber: template.inhaber,
    rechnungsnummer: order.orderId,
    zahlungsfrist: String(paymentTermsDays),
    iban: template.iban,
    bank: template.bankname ? ` (${template.bankname})` : "",
    datum: formatInvoiceDate(order.createdAt),
  }

  const headerInvoiceLine = applyInvoiceTemplatePlaceholders(
    template.headerInvoiceLine,
    placeholderValues
  )
  const headerReferenceLine = applyInvoiceTemplatePlaceholders(
    template.headerReferenceLine,
    placeholderValues
  )
  const introText = applyInvoiceTemplatePlaceholders(template.introText, placeholderValues)
  const paymentBlockText = applyInvoiceTemplatePlaceholders(
    template.paymentBlockText,
    placeholderValues
  )
  const centerFooterText = applyInvoiceTemplatePlaceholders(
    template.centerFooterText,
    placeholderValues
  )

  const recipient = order.delivery ?? order.billing
  const accountHolder = template.inhaber
    ? `${template.firmenname}\n${template.inhaber}`
    : template.firmenname

  const showPaymentBlock =
    order.paymentMethod === "invoice" || Boolean(template.iban)

  return (
    <Document title={`Rechnung ${order.orderId}`} author={template.firmenname}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.returnAddress}>{buildReturnAddress(template)}</Text>

        {logoUrl ? (
          <View style={styles.logoWrap}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image */}
            <Image style={styles.logo} src={logoUrl} />
          </View>
        ) : null}

        <View style={styles.recipientBlock}>
          <Text style={styles.recipientLine}>
            {recipient.firstName} {recipient.lastName}
          </Text>
          <Text style={styles.recipientLine}>{recipient.street}</Text>
          <Text style={styles.recipientLine}>
            {recipient.zip} {recipient.city}
          </Text>
          <Text style={styles.recipientLine}>{recipient.country}</Text>
        </View>

        <View style={styles.dateBlock}>
          <Text style={styles.dateLabel}>Datum</Text>
          <Text style={styles.dateValue}>{formatInvoiceDate(order.createdAt)}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.headerRule} />
          <View style={styles.headerAccent} />
          <Text style={styles.headerInvoiceLine}>{headerInvoiceLine}</Text>
          {headerReferenceLine ? (
            <Text style={styles.headerReferenceLine}>{headerReferenceLine}</Text>
          ) : null}
          {introText ? <Text style={styles.introText}>{introText}</Text> : null}

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.colProduct, styles.th]}>Produkt</Text>
              <Text style={[styles.colDetails, styles.th]}>Details</Text>
              <Text style={[styles.colQty, styles.th]}>Menge</Text>
              <Text style={[styles.colUnit, styles.th]}>Einzelpreis</Text>
              <Text style={[styles.colTotal, styles.th]}>Total</Text>
            </View>
            {order.items.map((item, index) => (
              <View
                key={item.id}
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <View style={styles.colProduct}>
                  <Text style={styles.cellProduct}>{item.name}</Text>
                </View>
                <View style={styles.colDetails}>
                  <Text style={styles.cellDetails}>{formatInvoiceItemDetails(item)}</Text>
                </View>
                <Text style={[styles.colQty, styles.cellQty]}>{item.quantity}</Text>
                <Text style={[styles.colUnit, styles.cellMoney]}>{formatChf(item.price)}</Text>
                <Text style={[styles.colTotal, styles.cellMoneyBold]}>
                  {formatChf(getInvoiceLineTotal(item))}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.totalsWrap}>
            <View style={styles.totalsBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Zwischensumme</Text>
                <Text>{formatChf(order.totals.subtotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Versand ({shippingLabel(order.shippingMethod)})
                </Text>
                <Text>{formatChf(order.totals.shippingCost)}</Text>
              </View>
              {(order.totals.discountAmount ?? 0) > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    Rabatt{order.totals.couponCode ? ` (${order.totals.couponCode})` : ""}
                  </Text>
                  <Text>− {formatChf(order.totals.discountAmount ?? 0)}</Text>
                </View>
              ) : null}
              {order.totals.mwstAktiv ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>MwSt. ({mwstSatz.toFixed(1)}%)</Text>
                  <Text>{formatChf(order.totals.vat)}</Text>
                </View>
              ) : null}
              <View style={styles.totalGrand}>
                <Text style={styles.totalGrandLabel}>Gesamtbetrag</Text>
                <Text style={styles.totalGrandValue}>{formatChf(order.totals.total)}</Text>
              </View>
              {!order.totals.mwstAktiv ? (
                <Text style={styles.vatNote}>
                  MwSt.-befreit (Kleinunternehmer gem. Art. 10 MWSTG)
                </Text>
              ) : null}
            </View>
          </View>

          {template.footerNote ? (
            <Text style={[styles.introText, { marginBottom: 0 }]}>{template.footerNote}</Text>
          ) : null}
        </View>

        {showPaymentBlock ? (
          <View style={styles.paymentBlock} fixed>
            <View style={styles.paymentLeft}>
              <Text style={styles.paymentSectionTitle}>Zahlungsinformationen</Text>
              <Text style={styles.paymentLineBold}>Kontoinhaber</Text>
              <Text style={styles.paymentLine}>{accountHolder}</Text>
              {template.iban ? (
                <>
                  <Text style={[styles.paymentLineBold, { marginTop: 6 }]}>IBAN</Text>
                  <Text style={styles.paymentLine}>{template.iban}</Text>
                </>
              ) : null}
              {template.bankname ? (
                <Text style={styles.paymentLine}>{template.bankname}</Text>
              ) : null}
              <Text style={styles.paymentLineBold}>Referenz / Zahlungszweck</Text>
              <Text style={styles.paymentLine}>{order.orderId}</Text>
              <Text style={styles.paymentAmount}>{formatChf(order.totals.total)}</Text>
              {paymentBlockText ? (
                <Text style={styles.paymentNote}>{paymentBlockText}</Text>
              ) : null}
            </View>
            <View style={styles.paymentRight}>
              {qrDataUrl ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image */}
                  <Image style={styles.qrImage} src={qrDataUrl} />
                  <Text style={styles.qrLabel}>Swiss QR-Rechnung</Text>
                </>
              ) : (
                <Text style={styles.qrLabel}>QR-Code nach IBAN-Eintrag verfuegbar</Text>
              )}
            </View>
          </View>
        ) : null}

        {centerFooterText ? (
          <Text style={styles.centerFooter} fixed>
            {centerFooterText}
          </Text>
        ) : null}
      </Page>
    </Document>
  )
}
