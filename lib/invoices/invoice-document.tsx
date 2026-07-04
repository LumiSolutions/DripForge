import { StyleSheet, Text, View } from "@react-pdf/renderer"
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { SHIPPING_OPTIONS } from "@/lib/dripforge/checkout-config"
import { formatChf, formatInvoiceDate } from "@/lib/invoices/invoice-format"
import {
  formatInvoiceItemDetails,
  getInvoiceLineTotal,
} from "@/lib/invoices/invoice-item-details"
import {
  buildDocumentPlaceholderValues,
  type DocumentTemplateSettings,
  type DocumentTemplateType,
} from "@/lib/documents/document-template-types"
import {
  PdfDocumentLayout,
  pdfDocumentColors,
} from "@/lib/documents/pdf-document-layout"

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: pdfDocumentColors.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: pdfDocumentColors.tableHeader,
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
    borderBottomColor: pdfDocumentColors.border,
  },
  tableRowAlt: {
    backgroundColor: pdfDocumentColors.bgMuted,
  },
  colProduct: { width: "24%" },
  colDetails: { width: "36%" },
  colQty: { width: "8%", textAlign: "center" },
  colUnit: { width: "16%", textAlign: "right" },
  colTotal: { width: "16%", textAlign: "right" },
  cellProduct: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: pdfDocumentColors.anthracite,
  },
  cellDetails: {
    fontSize: 7.5,
    color: pdfDocumentColors.anthraciteLight,
    lineHeight: 1.35,
  },
  cellQty: {
    fontSize: 8.5,
    textAlign: "center",
    color: pdfDocumentColors.anthraciteMid,
  },
  cellMoney: {
    fontSize: 8.5,
    textAlign: "right",
    color: pdfDocumentColors.anthraciteMid,
  },
  cellMoneyBold: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    textAlign: "right",
    color: pdfDocumentColors.anthracite,
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
    borderColor: pdfDocumentColors.border,
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
    color: pdfDocumentColors.anthraciteLight,
  },
  totalGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: pdfDocumentColors.orange,
  },
  totalGrandLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: pdfDocumentColors.anthracite,
  },
  totalGrandValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: pdfDocumentColors.anthracite,
  },
  vatNote: {
    marginTop: 6,
    fontSize: 7.5,
    color: pdfDocumentColors.anthraciteLight,
    fontStyle: "italic",
    textAlign: "right",
  },
})

export type InvoiceDocumentProps = {
  order: StoredOrder
  settings: AdminSettings
  template: DocumentTemplateSettings
  qrDataUrl?: string | null
  documentType?: DocumentTemplateType
}

function shippingLabel(method: StoredOrder["shippingMethod"]): string {
  return SHIPPING_OPTIONS.find((o) => o.id === method)?.label ?? method
}

export function InvoiceDocument({
  order,
  settings,
  template,
  qrDataUrl,
  documentType = "invoice",
}: InvoiceDocumentProps) {
  const { checkout } = settings
  const mwstSatz = checkout.mwstSatz
  const documentText = template.documentTypes[documentType]
  const formattedDate = formatInvoiceDate(order.createdAt)

  const placeholderValues = buildDocumentPlaceholderValues(template, {
    belegnummer: order.orderId,
    dokumentnummer: order.orderId,
    dokumenttyp: documentText.label,
    rechnungsnummer: order.orderId,
    angebotsnummer: order.orderId,
    lieferscheinnummer: order.orderId,
    datum: formattedDate,
  })

  const recipient = order.delivery ?? order.billing

  const payment =
    documentText.showPaymentBlock && (order.paymentMethod === "invoice" || Boolean(template.iban))
      ? {
          amount: order.totals.total,
          reference: order.orderId,
          qrDataUrl,
        }
      : null

  return (
    <PdfDocumentLayout
      title={`${documentText.label} ${order.orderId}`}
      template={template}
      documentText={documentText}
      recipient={recipient}
      date={formattedDate}
      placeholderValues={placeholderValues}
      payment={payment}
    >
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
              <Text>- {formatChf(order.totals.discountAmount ?? 0)}</Text>
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
    </PdfDocumentLayout>
  )
}
