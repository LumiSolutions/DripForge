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
  resolveOrderBestellRef,
  resolveOrderInvoiceNumber,
} from "@/lib/invoices/order-invoice-display"
import {
  formatInvoiceItemDetails,
  getInvoiceLineTotal,
} from "@/lib/invoices/invoice-item-details"
import {
  sanitizePdfText,
} from "@/lib/documents/sanitize-pdf-text"

function scaledSize(baseFontSize: number, sizeAtBase9: number): number {
  return Math.round(sizeAtBase9 * (baseFontSize / 9) * 10) / 10
}

/** Saubere ASCII-Header ohne Soft-Hyphen / Entities. */
const TABLE_HEADER = {
  pos: "Pos",
  leistung: "Leistung & Beschreibung",
  menge: "Menge (Aufwand)",
  einzelpreis: "Einzelpreis (Ansatz)",
  betrag: "Betrag",
} as const

function createInvoiceDocumentStyles(template: DocumentTemplateSettings) {
  const base = template.baseFontSize
  const bold = pdfBoldStyle(template.fontFamily)

  return StyleSheet.create({
    table: {
      borderWidth: 1,
      borderColor: pdfDocumentColors.border,
      borderRadius: 3,
      overflow: "hidden",
      marginBottom: 14,
      marginTop: 2,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: pdfDocumentColors.tableHeader,
      paddingVertical: 9,
      paddingHorizontal: 6,
      alignItems: "center",
    },
    th: {
      color: "#ffffff",
      ...bold,
      fontSize: scaledSize(base, 5.8),
      textTransform: "uppercase",
      letterSpacing: 0.2,
      whiteSpace: "nowrap",
      hyphens: "none",
    },
    /** Menge / Einzelpreis / Betrag: nie mitten im Wort umbrechen */
    thNowrap: {
      color: "#ffffff",
      ...bold,
      fontSize: scaledSize(base, 5.8),
      textTransform: "uppercase",
      letterSpacing: 0.2,
      whiteSpace: "nowrap",
      hyphens: "none",
    },
    thCenter: {
      textAlign: "center",
    },
    thRight: {
      textAlign: "right",
    },
    tableRow: {
      flexDirection: "row",
      paddingVertical: 9,
      paddingHorizontal: 6,
      borderBottomWidth: 1,
      borderBottomColor: pdfDocumentColors.border,
      alignItems: "flex-start",
    },
    tableRowAlt: {
      backgroundColor: pdfDocumentColors.bgMuted,
    },
    // EINZELPREIS (ANSATZ) braucht mehr Breite — sonst Soft-Wrap/Glyphen-Artefakte
    colPos: { width: "5%" },
    colLeistung: { width: "36%" },
    colQty: { width: "16%" },
    colUnit: { width: "24%" },
    colBetrag: { width: "19%" },
    colLeistungWide: { width: "79%" },
    colQtyWide: { width: "16%" },
    cellPos: {
      fontSize: scaledSize(base, 8),
      color: pdfDocumentColors.anthraciteMid,
      textAlign: "center",
      hyphens: "none",
    },
    cellName: {
      ...bold,
      fontSize: scaledSize(base, 8.5),
      color: pdfDocumentColors.anthracite,
      marginBottom: 2,
      hyphens: "none",
    },
    cellDetails: {
      fontSize: scaledSize(base, 7),
      color: pdfDocumentColors.anthraciteLight,
      lineHeight: 1.4,
      hyphens: "none",
    },
    cellQty: {
      fontSize: scaledSize(base, 8),
      textAlign: "center",
      color: pdfDocumentColors.anthraciteMid,
      whiteSpace: "nowrap",
      hyphens: "none",
    },
    cellMoney: {
      fontSize: scaledSize(base, 8),
      textAlign: "right",
      color: pdfDocumentColors.anthraciteMid,
      whiteSpace: "nowrap",
      hyphens: "none",
    },
    cellMoneyBold: {
      ...bold,
      fontSize: scaledSize(base, 8),
      textAlign: "right",
      color: pdfDocumentColors.anthracite,
      whiteSpace: "nowrap",
      hyphens: "none",
    },
    totalsWrap: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginBottom: 10,
      marginTop: 4,
    },
    legalNote: {
      fontSize: scaledSize(base, 7),
      color: pdfDocumentColors.anthraciteLight,
      marginBottom: 14,
      marginTop: 4,
      lineHeight: 1.45,
      hyphens: "none",
    },
    sectionHeading: {
      ...bold,
      fontSize: scaledSize(base, 8),
      textTransform: "uppercase",
      letterSpacing: 0.7,
      color: pdfDocumentColors.anthraciteMid,
      marginBottom: 8,
      hyphens: "none",
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
      hyphens: "none",
    },
    totalValue: {
      textAlign: "right",
      color: pdfDocumentColors.anthraciteMid,
      whiteSpace: "nowrap",
      hyphens: "none",
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
      hyphens: "none",
    },
    totalSubtotalValue: {
      ...bold,
      fontSize: scaledSize(base, 8.5),
      textAlign: "right",
      color: pdfDocumentColors.anthracite,
      whiteSpace: "nowrap",
      hyphens: "none",
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
      hyphens: "none",
    },
    totalGrandValue: {
      ...bold,
      fontSize: scaledSize(base, 11),
      textAlign: "right",
      color: "#ffffff",
      whiteSpace: "nowrap",
      hyphens: "none",
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
  const invoiceNumber = resolveOrderInvoiceNumber(order)
  const bestellRef = resolveOrderBestellRef(order)

  const placeholderValues = buildDocumentPlaceholderValues(template, {
    belegnummer: invoiceNumber,
    dokumentnummer: invoiceNumber,
    dokumenttyp: documentText.label,
    rechnungsnummer: invoiceNumber,
    angebotsnummer: invoiceNumber,
    lieferscheinnummer: invoiceNumber,
    bestellnummer: bestellRef ?? order.orderId,
    datum: formattedDate,
  })

  const recipient = order.delivery ?? order.billing

  const alreadyPaid = isOrderAlreadyPaid(order)
  const payment =
    documentText.showPaymentBlock &&
    (alreadyPaid || order.paymentMethod === "invoice" || Boolean(template.iban))
      ? {
          amount: order.totals.total,
          reference: invoiceNumber,
          qrImageUrl: alreadyPaid ? null : template.qrPaymentImageUrl,
          alreadyPaid,
          paymentMethodLabel: getOrderPaymentMethodDisplayLabel(order),
          paymentProviderRef:
            order.stripeSessionId?.trim() ||
            order.payrexxTransactionUuid?.trim() ||
            null,
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

  const documentTextForLayout = {
    ...documentText,
    headerLine:
      documentType === "invoice"
        ? "Rechnung Nr. {rechnungsnummer}"
        : documentText.headerLine,
    referenceLine: bestellRef
      ? "Bestell-Ref: {bestellnummer}"
      : documentText.referenceLine,
  }

  return (
    <PdfDocumentLayout
      title={`${documentText.label} Nr. ${invoiceNumber}`}
      template={template}
      documentText={documentTextForLayout}
      documentType={documentType}
      recipient={recipient}
      documentMeta={{
        documentNumber: invoiceNumber,
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
      <Text style={styles.sectionHeading}>Artikelübersicht</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.colPos, styles.th, styles.thCenter]} wrap={false}>
            {TABLE_HEADER.pos}
          </Text>
          <Text
            style={[
              isDeliveryNote ? styles.colLeistungWide : styles.colLeistung,
              styles.th,
            ]}
            wrap={false}
          >
            {TABLE_HEADER.leistung}
          </Text>
          <Text
            style={[
              isDeliveryNote ? styles.colQtyWide : styles.colQty,
              styles.thNowrap,
              styles.thCenter,
            ]}
            wrap={false}
          >
            {TABLE_HEADER.menge}
          </Text>
          {!isDeliveryNote ? (
            <>
              <Text
                style={[styles.colUnit, styles.thNowrap, styles.thRight]}
                wrap={false}
              >
                {TABLE_HEADER.einzelpreis}
              </Text>
              <Text
                style={[styles.colBetrag, styles.thNowrap, styles.thRight]}
                wrap={false}
              >
                {TABLE_HEADER.betrag}
              </Text>
            </>
          ) : null}
        </View>
        {order.items.map((item, index) => {
          const details = sanitizePdfText(formatInvoiceItemDetails(item))
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
                <Text style={styles.cellName}>
                  {sanitizePdfText(item.name)}
                </Text>
                {details ? (
                  <Text style={styles.cellDetails}>{details}</Text>
                ) : null}
              </View>
              <Text
                style={[
                  isDeliveryNote ? styles.colQtyWide : styles.colQty,
                  styles.cellQty,
                ]}
                wrap={false}
              >
                {sanitizePdfText(
                  formatBelegQuantityWithUnit(item.quantity, item.unit)
                )}
              </Text>
              {!isDeliveryNote ? (
                <>
                  <Text
                    style={[styles.colUnit, styles.cellMoney]}
                    wrap={false}
                  >
                    {sanitizePdfText(formatChf(item.price))}
                  </Text>
                  <Text
                    style={[styles.colBetrag, styles.cellMoneyBold]}
                    wrap={false}
                  >
                    {sanitizePdfText(formatChf(getInvoiceLineTotal(item)))}
                  </Text>
                </>
              ) : null}
            </View>
          )
        })}
      </View>

      {!isDeliveryNote && !order.totals.mwstAktiv ? (
        <Text style={styles.legalNote}>
          {sanitizePdfText(MWST_EXEMPT_LEGAL_NOTE)}
        </Text>
      ) : null}

      {!isDeliveryNote ? (
        <View style={styles.totalsWrap} wrap={false}>
          <View style={styles.totalsBox}>
            <View style={styles.totalSubtotalRow}>
              <Text style={styles.totalSubtotalLabel}>Zwischensumme</Text>
              <Text style={styles.totalSubtotalValue}>
                {sanitizePdfText(formatChf(order.totals.subtotal))}
              </Text>
            </View>
            {showShipping ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {sanitizePdfText(
                    `Versand (${shippingLabel(order.shippingMethod)})`
                  )}
                </Text>
                <Text style={styles.totalValue}>
                  {sanitizePdfText(formatChf(order.totals.shippingCost))}
                </Text>
              </View>
            ) : null}
            {(order.totals.discountAmount ?? 0) > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {sanitizePdfText(
                    `Rabatt${
                      order.totals.couponCode
                        ? ` (${order.totals.couponCode})`
                        : ""
                    }`
                  )}
                </Text>
                <Text style={styles.totalValue}>
                  {sanitizePdfText(
                    `- ${formatChf(order.totals.discountAmount ?? 0)}`
                  )}
                </Text>
              </View>
            ) : null}
            {order.totals.mwstAktiv ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {sanitizePdfText(`MwSt. (${mwstSatz.toFixed(1)}%)`)}
                </Text>
                <Text style={styles.totalValue}>
                  {sanitizePdfText(formatChf(order.totals.vat))}
                </Text>
              </View>
            ) : null}
            <View style={styles.totalGrand}>
              <Text style={styles.totalGrandLabel}>Gesamtbetrag</Text>
              <Text style={styles.totalGrandValue}>
                {sanitizePdfText(formatChf(order.totals.total))}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </PdfDocumentLayout>
  )
}
