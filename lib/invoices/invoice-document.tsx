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
import { formatBelegQuantityWithUnit } from "@/lib/documents/beleg-types"
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
      marginBottom: 10,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: pdfDocumentColors.tableHeader,
      paddingVertical: 8,
      paddingHorizontal: 8,
      alignItems: "center",
    },
    th: {
      color: "#ffffff",
      ...bold,
      fontSize: scaledSize(base, 6.2),
      textTransform: "uppercase",
      letterSpacing: 0.35,
    },
    thCenter: {
      textAlign: "center",
    },
    thRight: {
      textAlign: "right",
    },
    tableRow: {
      flexDirection: "row",
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: pdfDocumentColors.border,
      alignItems: "flex-start",
    },
    tableRowAlt: {
      backgroundColor: pdfDocumentColors.bgMuted,
    },
    colPos: { width: "7%" },
    colLeistung: { width: "43%" },
    colQty: { width: "16%" },
    colUnit: { width: "17%" },
    colBetrag: { width: "17%" },
    // Lieferschein ohne Preise
    colLeistungWide: { width: "77%" },
    colQtyWide: { width: "16%" },
    cellPos: {
      fontSize: scaledSize(base, 8),
      color: pdfDocumentColors.anthraciteMid,
      textAlign: "center",
    },
    cellName: {
      ...bold,
      fontSize: scaledSize(base, 8.5),
      color: pdfDocumentColors.anthracite,
      marginBottom: 2,
    },
    cellDetails: {
      fontSize: scaledSize(base, 7),
      color: pdfDocumentColors.anthraciteLight,
      lineHeight: 1.4,
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
      width: "48%",
      minWidth: 200,
      borderWidth: 1,
      borderColor: pdfDocumentColors.border,
      borderRadius: 3,
      overflow: "hidden",
      backgroundColor: pdfDocumentColors.totalsBg,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 5,
      paddingHorizontal: 12,
      fontSize: scaledSize(base, 8.5),
    },
    totalLabel: {
      color: pdfDocumentColors.anthraciteLight,
    },
    totalValue: {
      textAlign: "right",
      color: pdfDocumentColors.anthraciteMid,
    },
    totalSubtotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 7,
      paddingHorizontal: 12,
      backgroundColor: pdfDocumentColors.totalsAccent,
      borderBottomWidth: 1,
      borderBottomColor: pdfDocumentColors.border,
    },
    totalSubtotalLabel: {
      ...bold,
      fontSize: scaledSize(base, 8.5),
      color: pdfDocumentColors.anthracite,
    },
    totalSubtotalValue: {
      ...bold,
      fontSize: scaledSize(base, 8.5),
      textAlign: "right",
      color: pdfDocumentColors.anthracite,
    },
    totalGrand: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 9,
      paddingHorizontal: 12,
      backgroundColor: pdfDocumentColors.tableHeader,
    },
    totalGrandLabel: {
      ...bold,
      fontSize: scaledSize(base, 10),
      color: "#ffffff",
    },
    totalGrandValue: {
      ...bold,
      fontSize: scaledSize(base, 11),
      textAlign: "right",
      color: "#ffffff",
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
  const isQuote = documentType === "quote"
  const showShipping = order.totals.shippingCost > 0

  const paymentTermsLabel = isDeliveryNote
    ? "—"
    : isQuote
      ? `${template.paymentTermsDays} Tage`
      : getInvoicePaymentTermsLabel(
          order.paymentMethod,
          template.paymentTermsDays
        )

  return (
    <PdfDocumentLayout
      title={`${documentText.label} ${order.orderId}`}
      template={template}
      documentText={documentText}
      documentType={documentType}
      recipient={recipient}
      documentMeta={{
        documentNumber: order.orderId,
        documentDate: formattedDate,
        paymentTermsLabel,
        dueDate: isDeliveryNote
          ? "—"
          : formatDocumentDueDate(order.createdAt, template.paymentTermsDays),
        shippingLabel: shippingLabel(order.shippingMethod),
      }}
      placeholderValues={placeholderValues}
      payment={isDeliveryNote || isQuote ? null : payment}
    >
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.colPos, styles.th, styles.thCenter]}>Pos</Text>
          <Text
            style={[
              isDeliveryNote ? styles.colLeistungWide : styles.colLeistung,
              styles.th,
            ]}
          >
            Leistung & Beschreibung
          </Text>
          <Text
            style={[
              isDeliveryNote ? styles.colQtyWide : styles.colQty,
              styles.th,
              styles.thCenter,
            ]}
          >
            Menge (Aufwand)
          </Text>
          {!isDeliveryNote ? (
            <>
              <Text style={[styles.colUnit, styles.th, styles.thRight]}>
                Einzelpreis (Ansatz)
              </Text>
              <Text style={[styles.colBetrag, styles.th, styles.thRight]}>
                Betrag
              </Text>
            </>
          ) : null}
        </View>
        {order.items.map((item, index) => {
          const details = formatInvoiceItemDetails(item)
          return (
            <View
              key={item.id}
              wrap={false}
              style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.colPos, styles.cellPos]}>{index + 1}</Text>
              <View
                style={
                  isDeliveryNote ? styles.colLeistungWide : styles.colLeistung
                }
              >
                <Text style={styles.cellName}>{item.name}</Text>
                {details ? (
                  <Text style={styles.cellDetails}>{details}</Text>
                ) : null}
              </View>
              <Text
                style={[
                  isDeliveryNote ? styles.colQtyWide : styles.colQty,
                  styles.cellQty,
                ]}
              >
                {formatBelegQuantityWithUnit(item.quantity, item.unit)}
              </Text>
              {!isDeliveryNote ? (
                <>
                  <Text style={[styles.colUnit, styles.cellMoney]}>
                    {formatChf(item.price)}
                  </Text>
                  <Text style={[styles.colBetrag, styles.cellMoneyBold]}>
                    {formatChf(getInvoiceLineTotal(item))}
                  </Text>
                </>
              ) : null}
            </View>
          )
        })}
      </View>

      {!isDeliveryNote && !order.totals.mwstAktiv ? (
        <Text style={styles.legalNote}>{MWST_EXEMPT_LEGAL_NOTE}</Text>
      ) : null}

      {!isDeliveryNote ? (
        <View style={styles.totalsWrap} wrap={false}>
          <View style={styles.totalsBox}>
            <View style={styles.totalSubtotalRow}>
              <Text style={styles.totalSubtotalLabel}>Zwischensumme</Text>
              <Text style={styles.totalSubtotalValue}>
                {formatChf(order.totals.subtotal)}
              </Text>
            </View>
            {showShipping ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Versand ({shippingLabel(order.shippingMethod)})
                </Text>
                <Text style={styles.totalValue}>
                  {formatChf(order.totals.shippingCost)}
                </Text>
              </View>
            ) : null}
            {(order.totals.discountAmount ?? 0) > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Rabatt
                  {order.totals.couponCode ? ` (${order.totals.couponCode})` : ""}
                </Text>
                <Text style={styles.totalValue}>
                  - {formatChf(order.totals.discountAmount ?? 0)}
                </Text>
              </View>
            ) : null}
            {order.totals.mwstAktiv ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  MwSt. ({mwstSatz.toFixed(1)}%)
                </Text>
                <Text style={styles.totalValue}>{formatChf(order.totals.vat)}</Text>
              </View>
            ) : null}
            <View style={styles.totalGrand}>
              <Text style={styles.totalGrandLabel}>Gesamtbetrag</Text>
              <Text style={styles.totalGrandValue}>
                {formatChf(order.totals.total)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </PdfDocumentLayout>
  )
}
