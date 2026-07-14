import { StyleSheet, Text, View } from "@react-pdf/renderer"
import type { AdminSettings, StoredOrder } from "@/lib/admin/types"
import { SHIPPING_OPTIONS } from "@/lib/dripforge/checkout-config"
import {
  MWST_EXEMPT_LEGAL_NOTE,
  buildDocumentPlaceholderValues,
  formatDocumentDueDate,
  type DocumentTemplateSettings,
  type DocumentTemplateType,
} from "@/lib/documents/document-template-types"
import { PdfDocumentLayout, pdfDocumentColors } from "@/lib/documents/pdf-document-layout"
import { pdfBoldStyle } from "@/lib/documents/pdf-fonts"
import {
  formatChf,
  formatInvoiceDate,
  getInvoicePaymentTermsLabel,
  getOrderPaymentMethodDisplayLabel,
  isOrderAlreadyPaid,
} from "@/lib/invoices/invoice-format"
import {
  formatInvoiceItemDetails,
  getInvoiceLineTotal,
} from "@/lib/invoices/invoice-item-details"

function scaledSize(baseFontSize: number, sizeAtBase9: number): number {
  return Math.round(sizeAtBase9 * (baseFontSize / 9) * 10) / 10
}

function createInvoiceDocumentStyles(template: DocumentTemplateSettings) {
  const base = template.baseFontSize
  const bold = pdfBoldStyle(template.fontFamily)

  return StyleSheet.create({
    table: {
      borderWidth: 1,
      borderColor: pdfDocumentColors.border,
      borderRadius: 3,
      overflow: "hidden",
      marginBottom: 8,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: pdfDocumentColors.tableHeader,
      paddingVertical: 7,
      paddingHorizontal: 6,
    },
    th: {
      color: "#ffffff",
      ...bold,
      fontSize: scaledSize(base, 6.5),
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    tableRow: {
      flexDirection: "row",
      paddingVertical: 7,
      paddingHorizontal: 6,
      borderBottomWidth: 1,
      borderBottomColor: pdfDocumentColors.border,
    },
    tableRowAlt: {
      backgroundColor: pdfDocumentColors.bgMuted,
    },
    colProduct: { width: "18%" },
    colDetails: { width: "28%" },
    colQty: { width: "8%", textAlign: "center" },
    colUnit: { width: "14%", textAlign: "right" },
    colTotal: { width: "14%", textAlign: "right" },
    colVat: { width: "10%", textAlign: "right" },
    cellProduct: {
      ...bold,
      fontSize: scaledSize(base, 8),
      color: pdfDocumentColors.anthracite,
    },
    cellDetails: {
      fontSize: scaledSize(base, 7),
      color: pdfDocumentColors.anthraciteLight,
      lineHeight: 1.35,
    },
    cellQty: {
      fontSize: scaledSize(base, 8),
      textAlign: "center",
      color: pdfDocumentColors.anthraciteMid,
    },
    cellMoney: {
      fontSize: scaledSize(base, 8),
      textAlign: "right",
      color: pdfDocumentColors.anthraciteMid,
    },
    cellMoneyBold: {
      ...bold,
      fontSize: scaledSize(base, 8),
      textAlign: "right",
      color: pdfDocumentColors.anthracite,
    },
    cellVat: {
      fontSize: scaledSize(base, 8),
      textAlign: "right",
      color: pdfDocumentColors.anthraciteMid,
    },
    legalNote: {
      fontSize: scaledSize(base, 7),
      color: pdfDocumentColors.anthraciteLight,
      marginBottom: 12,
      lineHeight: 1.35,
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
      fontSize: scaledSize(base, 8.5),
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
      ...bold,
      fontSize: scaledSize(base, 10),
      color: pdfDocumentColors.anthracite,
    },
    totalGrandValue: {
      ...bold,
      fontSize: scaledSize(base, 11),
      color: pdfDocumentColors.anthracite,
    },
  })
}

export type InvoiceDocumentProps = {
  order: StoredOrder
  settings: AdminSettings
  template: DocumentTemplateSettings
  documentType?: DocumentTemplateType
}

function shippingLabel(method: StoredOrder["shippingMethod"]): string {
  return SHIPPING_OPTIONS.find((o) => o.id === method)?.label ?? method
}

function itemVatLabel(mwstAktiv: boolean, mwstSatz: number): string {
  return mwstAktiv ? `${mwstSatz.toFixed(1)}%` : "0%"
}

export function InvoiceDocument({
  order,
  settings,
  template,
  documentType = "invoice",
}: InvoiceDocumentProps) {
  const { checkout } = settings
  const mwstSatz = checkout.mwstSatz
  const documentText = template.documentTypes[documentType]
  const formattedDate = formatInvoiceDate(order.createdAt)
  const vatLabel = itemVatLabel(order.totals.mwstAktiv, mwstSatz)

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

  const alreadyPaid = isOrderAlreadyPaid(order)
  const payment =
    documentText.showPaymentBlock &&
    (alreadyPaid || order.paymentMethod === "invoice" || Boolean(template.iban))
      ? {
          amount: order.totals.total,
          reference: order.orderId,
          qrImageUrl: alreadyPaid ? null : template.qrPaymentImageUrl,
          alreadyPaid,
          paymentMethodLabel: getOrderPaymentMethodDisplayLabel(order),
        }
      : null

  const styles = createInvoiceDocumentStyles(template)
  const isDeliveryNote = documentType === "deliveryNote"

  return (
    <PdfDocumentLayout
      title={`${documentText.label} ${order.orderId}`}
      template={template}
      documentText={documentText}
      recipient={recipient}
      documentMeta={{
        documentNumber: order.orderId,
        documentDate: formattedDate,
        paymentTermsLabel: isDeliveryNote
          ? "—"
          : getInvoicePaymentTermsLabel(
              order.paymentMethod,
              template.paymentTermsDays
            ),
        dueDate: isDeliveryNote
          ? "—"
          : formatDocumentDueDate(order.createdAt, template.paymentTermsDays),
        shippingLabel: shippingLabel(order.shippingMethod),
      }}
      placeholderValues={placeholderValues}
      payment={isDeliveryNote ? null : payment}
    >
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.colProduct, styles.th]}>Produkt</Text>
          <Text style={[styles.colDetails, styles.th]}>Details</Text>
          <Text style={[styles.colQty, styles.th]}>Menge</Text>
          {!isDeliveryNote ? (
            <>
              <Text style={[styles.colUnit, styles.th]}>Einzelpreis</Text>
              <Text style={[styles.colTotal, styles.th]}>Total</Text>
              <Text style={[styles.colVat, styles.th]}>MWST</Text>
            </>
          ) : null}
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
            {!isDeliveryNote ? (
              <>
                <Text style={[styles.colUnit, styles.cellMoney]}>
                  {formatChf(item.price)}
                </Text>
                <Text style={[styles.colTotal, styles.cellMoneyBold]}>
                  {formatChf(getInvoiceLineTotal(item))}
                </Text>
                <Text style={[styles.colVat, styles.cellVat]}>{vatLabel}</Text>
              </>
            ) : null}
          </View>
        ))}
      </View>

      {!isDeliveryNote && !order.totals.mwstAktiv ? (
        <Text style={styles.legalNote}>{MWST_EXEMPT_LEGAL_NOTE}</Text>
      ) : null}

      {!isDeliveryNote ? (
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
          </View>
        </View>
      ) : null}
    </PdfDocumentLayout>
  )
}
