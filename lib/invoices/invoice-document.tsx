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
import {
  formatChf,
  formatInvoiceDate,
  DRIPFORGE_LOGO_URL,
  getInvoiceDueDateLabel,
  getInvoicePaymentTermsLabel,
  INVOICE_PAYMENT_TERMS_DAYS,
} from "@/lib/invoices/invoice-format"
import {
  formatInvoiceItemDetails,
  getInvoiceLineTotal,
} from "@/lib/invoices/invoice-item-details"

const anthracite = "#2d3139"
const anthraciteLight = "#6b7280"
const orange = "#f97316"
const border = "#e5e7eb"
const bgMuted = "#f9fafb"

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 52,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: anthracite,
    lineHeight: 1.45,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  companyBlock: {
    maxWidth: "55%",
  },
  companyName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: anthracite,
    marginBottom: 6,
  },
  companyLine: {
    color: anthraciteLight,
    marginBottom: 2,
  },
  logo: {
    width: 72,
    height: 72,
    objectFit: "contain",
  },
  accentBar: {
    height: 3,
    width: 72,
    backgroundColor: orange,
    marginBottom: 22,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: anthracite,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: anthraciteLight,
    marginBottom: 24,
  },
  twoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 24,
    marginBottom: 28,
  },
  block: {
    flex: 1,
  },
  blockTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: orange,
    marginBottom: 8,
  },
  blockText: {
    marginBottom: 2,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
    padding: 14,
    backgroundColor: bgMuted,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: border,
  },
  metaItem: {
    minWidth: "22%",
  },
  metaLabel: {
    fontSize: 7.5,
    color: anthraciteLight,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  metaValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  table: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: anthracite,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  th: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  tableRowAlt: {
    backgroundColor: bgMuted,
  },
  colProduct: { width: "28%" },
  colDetails: { width: "32%" },
  colQty: { width: "8%", textAlign: "center" },
  colUnit: { width: "16%", textAlign: "right" },
  colTotal: { width: "16%", textAlign: "right" },
  cellMuted: {
    color: anthraciteLight,
    fontSize: 8.5,
    marginTop: 2,
  },
  totalsBox: {
    marginLeft: "auto",
    width: "42%",
    borderWidth: 1,
    borderColor: border,
    borderRadius: 4,
    padding: 14,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  totalLabel: {
    color: anthraciteLight,
  },
  totalGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: orange,
  },
  totalGrandLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  totalGrandValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: anthracite,
  },
  vatNote: {
    marginTop: 12,
    fontSize: 8.5,
    color: anthraciteLight,
    fontStyle: "italic",
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: border,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: anthraciteLight,
  },
})

export type InvoiceDocumentProps = {
  order: StoredOrder
  settings: AdminSettings
}

function shippingLabel(method: StoredOrder["shippingMethod"]): string {
  return SHIPPING_OPTIONS.find((o) => o.id === method)?.label ?? method
}

export function InvoiceDocument({ order, settings }: InvoiceDocumentProps) {
  const { company, checkout } = settings
  const addressLines = company.firmenAdresse.split("\n").filter(Boolean)
  const mwstSatz = checkout.mwstSatz

  return (
    <Document title={`Rechnung ${order.orderId}`} author={company.firmenname}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topRow}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{company.firmenname}</Text>
            {addressLines.map((line) => (
              <Text key={line} style={styles.companyLine}>
                {line}
              </Text>
            ))}
            {company.kontaktEmail ? (
              <Text style={styles.companyLine}>{company.kontaktEmail}</Text>
            ) : null}
            {company.iban ? (
              <Text style={[styles.companyLine, { marginTop: 6 }]}>
                IBAN: {company.iban}
              </Text>
            ) : null}
            {company.bankname ? (
              <Text style={styles.companyLine}>{company.bankname}</Text>
            ) : null}
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image */}
          <Image style={styles.logo} src={DRIPFORGE_LOGO_URL} />
        </View>

        <View style={styles.accentBar} />

        <Text style={styles.title}>Rechnung</Text>
        <Text style={styles.subtitle}>
          Vielen Dank fuer Ihre Bestellung bei {company.firmenname}.
        </Text>

        <View style={styles.twoCol}>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Rechnungsadresse</Text>
            <Text style={styles.blockText}>
              {order.billing.firstName} {order.billing.lastName}
            </Text>
            <Text style={styles.blockText}>{order.billing.street}</Text>
            <Text style={styles.blockText}>
              {order.billing.zip} {order.billing.city}
            </Text>
            <Text style={styles.blockText}>{order.billing.country}</Text>
            {order.kundennummer ? (
              <Text style={[styles.blockText, { marginTop: 8 }]}>
                Kundennummer: {order.kundennummer}
              </Text>
            ) : null}
          </View>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Lieferadresse</Text>
            {order.delivery ? (
              <>
                <Text style={styles.blockText}>
                  {order.delivery.firstName} {order.delivery.lastName}
                </Text>
                <Text style={styles.blockText}>{order.delivery.street}</Text>
                <Text style={styles.blockText}>
                  {order.delivery.zip} {order.delivery.city}
                </Text>
                <Text style={styles.blockText}>{order.delivery.country}</Text>
              </>
            ) : (
              <Text style={styles.blockText}>Wie Rechnungsadresse</Text>
            )}
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Rechnungsnummer</Text>
            <Text style={styles.metaValue}>{order.orderId}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Rechnungsdatum</Text>
            <Text style={styles.metaValue}>{formatInvoiceDate(order.createdAt)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Zahlungsfrist</Text>
            <Text style={styles.metaValue}>
              {getInvoicePaymentTermsLabel(order.paymentMethod)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Faellig am</Text>
            <Text style={styles.metaValue}>
              {getInvoiceDueDateLabel(order.createdAt, order.paymentMethod)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Zahlungsart</Text>
            <Text style={styles.metaValue}>{order.paymentMethodLabel}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Versand</Text>
            <Text style={styles.metaValue}>{shippingLabel(order.shippingMethod)}</Text>
          </View>
        </View>

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
                <Text>{item.name}</Text>
              </View>
              <View style={styles.colDetails}>
                <Text style={styles.cellMuted}>{formatInvoiceItemDetails(item)}</Text>
              </View>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{formatChf(item.price)}</Text>
              <Text style={styles.colTotal}>{formatChf(getInvoiceLineTotal(item))}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Zwischensumme</Text>
            <Text>{formatChf(order.totals.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Versand ({shippingLabel(order.shippingMethod)})</Text>
            <Text>{formatChf(order.totals.shippingCost)}</Text>
          </View>
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

        {order.paymentMethod === "invoice" && company.iban ? (
          <Text style={[styles.vatNote, { marginTop: 18, fontStyle: "normal" }]}>
            Bitte ueberweisen Sie den Gesamtbetrag innerhalb von{" "}
            {INVOICE_PAYMENT_TERMS_DAYS} Tagen auf IBAN {company.iban}
            {company.bankname ? ` (${company.bankname})` : ""}. Verwendungszweck:{" "}
            {order.orderId}
          </Text>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>{company.firmenname} · {company.kontaktEmail}</Text>
          <Text>Rechnung {order.orderId}</Text>
        </View>
      </Page>
    </Document>
  )
}
