import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"
import type { ReactNode } from "react"
import {
  applyDocumentTemplatePlaceholders,
  DOCUMENT_HEADER_HEIGHT_MM,
  resolveDocumentFooterLines,
  resolveKontoinhaber,
  type DocumentLogoAlignment,
  type DocumentTemplateSettings,
  type DocumentTemplateType,
  type DocumentTypeTextSettings,
} from "@/lib/documents/document-template-types"
import { pdfBoldStyle, resolvePdfFontFamily } from "@/lib/documents/pdf-fonts"
import { sanitizePdfText } from "@/lib/documents/sanitize-pdf-text"
import { formatChf } from "@/lib/invoices/invoice-format"

const MM = 2.834645669
const PDF_CONTENT_WIDTH_MM = 170
/** Platz am unteren Rand für den fixen Footer (Inhalt darf nicht hineinragen). */
const FOOTER_RESERVED_MM = 24
const FOOTER_BOTTOM_OFFSET_MM = 12

export const pdfDocumentColors = {
  anthracite: "#1f2937",
  anthraciteMid: "#374151",
  anthraciteLight: "#6b7280",
  orange: "#f97316",
  border: "#cbd5e1",
  bgMuted: "#f1f5f9",
  infoPanel: "#f3f4f6",
  /** Blau-grau Tabellenkopf / Gesamtbetrag */
  tableHeader: "#5b7c99",
  totalsBg: "#ffffff",
  totalsAccent: "#e8eef5",
  paidGreen: "#15803d",
}

function scaledSize(baseFontSize: number, sizeAtBase9: number): number {
  return Math.round(sizeAtBase9 * (baseFontSize / 9) * 10) / 10
}

export function createPdfDocumentLayoutStyles(template: DocumentTemplateSettings) {
  const base = template.baseFontSize
  const font = resolvePdfFontFamily(template.fontFamily)
  const bold = pdfBoldStyle(template.fontFamily)
  const logoWidthMm = (PDF_CONTENT_WIDTH_MM * template.logoWidthPercent) / 100
  const headerHeightPt = DOCUMENT_HEADER_HEIGHT_MM * MM
  /** Extra Abstand unter dem Logo, damit Inhalt nicht in den Header ragt. */
  const headerBottomGapPt = 10
  const pagePaddingTop = headerHeightPt + headerBottomGapPt

  return StyleSheet.create({
    page: {
      fontFamily: font,
      fontSize: base,
      color: pdfDocumentColors.anthracite,
      lineHeight: 1.4,
      paddingTop: pagePaddingTop,
      paddingHorizontal: 20 * MM,
      paddingBottom: FOOTER_RESERVED_MM * MM,
      hyphens: "none",
    },
    paymentPage: {
      fontFamily: font,
      fontSize: base,
      color: pdfDocumentColors.anthracite,
      lineHeight: 1.4,
      paddingTop: pagePaddingTop,
      paddingHorizontal: 20 * MM,
      paddingBottom: FOOTER_RESERVED_MM * MM,
      position: "relative",
      hyphens: "none",
    },
    /** Zahlungsblock über dem Footer */
    paymentBottomContainer: {
      position: "absolute",
      bottom: FOOTER_RESERVED_MM * MM,
      left: 20 * MM,
      right: 20 * MM,
      backgroundColor: "transparent",
    },
    /**
     * Logo-Header auf jeder Seite (fixed).
     * Position absolut relativ zur Seite — Inhalt beginnt unter pagePaddingTop.
     */
    logoHeader: {
      position: "absolute",
      top: 0,
      left: 20 * MM,
      right: 20 * MM,
      height: headerHeightPt,
      justifyContent: "center",
    },
    logo: {
      width: logoWidthMm * MM,
      maxHeight: (DOCUMENT_HEADER_HEIGHT_MM - 6) * MM,
      objectFit: "contain",
    },
    recipientBlock: {
      marginBottom: 10,
      maxWidth: "52%",
      fontSize: scaledSize(base, 10),
      lineHeight: 1.45,
    },
    recipientLine: {
      marginBottom: 1,
    },
    infoPanel: {
      flexDirection: "row",
      backgroundColor: pdfDocumentColors.infoPanel,
      borderRadius: 3,
      paddingVertical: 8,
      paddingHorizontal: 10,
      marginBottom: 14,
    },
    infoField: {
      flex: 1,
      paddingRight: 6,
    },
    infoLabel: {
      fontSize: scaledSize(base, 6.5),
      color: pdfDocumentColors.anthraciteLight,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 3,
    },
    infoValue: {
      fontSize: scaledSize(base, 8.5),
      ...bold,
      color: pdfDocumentColors.anthracite,
    },
    headerRule: {
      height: 1,
      backgroundColor: pdfDocumentColors.border,
      marginBottom: 10,
    },
    headerAccent: {
      height: 2,
      width: 48,
      backgroundColor: pdfDocumentColors.orange,
      marginBottom: 10,
    },
    headerLine: {
      ...bold,
      fontSize: scaledSize(base, 13),
      color: pdfDocumentColors.anthracite,
      marginBottom: 4,
    },
    referenceLine: {
      fontSize: scaledSize(base, 9.5),
      color: pdfDocumentColors.anthraciteMid,
      marginBottom: 8,
    },
    introText: {
      fontSize: scaledSize(base, 9.5),
      color: pdfDocumentColors.anthraciteLight,
      marginBottom: 14,
      maxWidth: "90%",
    },
    footerNote: {
      fontSize: scaledSize(base, 9),
      color: pdfDocumentColors.anthraciteLight,
      marginTop: 8,
      maxWidth: "90%",
    },
    receiptNotice: {
      marginTop: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1.5,
      borderColor: pdfDocumentColors.paidGreen,
      borderRadius: 4,
      backgroundColor: "#f0fdf4",
    },
    receiptNoticeText: {
      fontSize: scaledSize(base, 9.5),
      color: pdfDocumentColors.paidGreen,
      lineHeight: 1.45,
      ...bold,
    },
    paymentInstructionTop: {
      fontSize: scaledSize(base, 8.5),
      color: "#4a5568",
      textAlign: "center",
      marginBottom: 10,
      lineHeight: 1.35,
    },
    paymentDashLine: {
      borderTopWidth: 1,
      borderTopColor: pdfDocumentColors.anthraciteMid,
      borderStyle: "dashed",
      marginTop: 0,
      marginBottom: 14,
    },
    paymentSection: {
      marginTop: 0,
      flexDirection: "row",
      alignItems: "flex-start",
    },
    paymentLeft: {
      flex: 1,
      paddingRight: 12,
    },
    paymentSectionTitle: {
      fontSize: scaledSize(base, 8),
      ...bold,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      color: pdfDocumentColors.orange,
      marginBottom: 8,
    },
    paymentLine: {
      fontSize: scaledSize(base, 8.5),
      marginBottom: 3,
      color: pdfDocumentColors.anthraciteMid,
    },
    paymentLineBold: {
      ...bold,
      fontSize: scaledSize(base, 9),
      color: pdfDocumentColors.anthracite,
      marginBottom: 4,
    },
    paymentRightColumn: {
      width: 52 * MM,
      alignItems: "center",
    },
    qrImage: {
      width: 46 * MM,
      height: 46 * MM,
      objectFit: "contain",
    },
    paymentAmount: {
      ...bold,
      fontSize: scaledSize(base, 12),
      color: pdfDocumentColors.anthracite,
      marginTop: 15,
      textAlign: "center",
    },
    paidStampWrap: {
      marginTop: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
    },
    paidStamp: {
      ...bold,
      fontSize: scaledSize(base, 28),
      color: pdfDocumentColors.paidGreen,
      letterSpacing: 2,
      textAlign: "center",
      borderWidth: 3,
      borderColor: pdfDocumentColors.paidGreen,
      paddingVertical: 10,
      paddingHorizontal: 18,
    },
    paidStampSub: {
      marginTop: 16,
      fontSize: scaledSize(base, 9),
      color: pdfDocumentColors.anthraciteMid,
      textAlign: "center",
      maxWidth: "85%",
    },
    /**
     * Fixer Footer am unteren Rand — erscheint auf jeder Seite (`fixed`).
     * Mehrzeilig, zentriert, dezentes Grau.
     */
    centerFooter: {
      position: "absolute",
      bottom: FOOTER_BOTTOM_OFFSET_MM * MM,
      left: 20 * MM,
      right: 20 * MM,
      textAlign: "center",
      lineHeight: 1.35,
    },
    footerLine1: {
      ...bold,
      fontSize: 9,
      color: pdfDocumentColors.anthraciteLight,
      marginBottom: 2,
      lineHeight: 1.35,
      textAlign: "center",
    },
    footerLine2: {
      fontSize: 9,
      color: pdfDocumentColors.anthraciteLight,
      marginBottom: 2,
      lineHeight: 1.35,
      textAlign: "center",
    },
    footerLine3: {
      fontSize: 9,
      color: pdfDocumentColors.anthraciteLight,
      lineHeight: 1.35,
      textAlign: "center",
    },
  })
}

export type PdfDocumentRecipient = {
  firstName: string
  lastName: string
  street: string
  zip: string
  city: string
  country: string
}

export type PdfDocumentMeta = {
  documentNumber: string
  documentDate: string
  paymentTermsLabel: string
  dueDate: string
  shippingLabel: string
}

/** Beschriftungen der grauen Meta-Infobox je Dokumenttyp. */
export type PdfInfoPanelLabels = {
  number: string
  date: string
  terms: string
  due: string
  shipping: string
}

export function resolvePdfInfoPanelLabels(
  documentType: DocumentTemplateType
): PdfInfoPanelLabels {
  if (documentType === "quote") {
    return {
      number: "Offertennummer",
      date: "Offertendatum",
      terms: "Gültigkeit",
      due: "Gültig bis",
      shipping: "Versandart",
    }
  }
  if (documentType === "deliveryNote") {
    return {
      number: "Lieferscheinnummer",
      date: "Lieferscheindatum",
      terms: "Lieferstatus",
      due: "Lieferdatum",
      shipping: "Versandart",
    }
  }
  return {
    number: "Rechnungsnummer",
    date: "Rechnungsdatum",
    terms: "Zahlungsfrist",
    due: "Fälligkeitsdatum",
    shipping: "Versandart",
  }
}

/** Land nur für Ausland anzeigen — CH/Schweiz entfällt im Adressblock. */
export function formatPdfRecipientCountry(
  country: string | null | undefined
): string | null {
  const raw = String(country ?? "").trim()
  if (!raw) return null

  const normalized = raw.toLowerCase().replace(/\./g, "")
  const swissAliases = new Set([
    "ch",
    "che",
    "schweiz",
    "switzerland",
    "suisse",
    "svizzera",
    "swiss",
  ])
  if (swissAliases.has(normalized)) return null

  const displayNames: Record<string, string> = {
    de: "Deutschland",
    deu: "Deutschland",
    deutschland: "Deutschland",
    at: "Österreich",
    aut: "Österreich",
    oesterreich: "Österreich",
    österreich: "Österreich",
    li: "Liechtenstein",
    lie: "Liechtenstein",
    fr: "Frankreich",
    fra: "Frankreich",
    frankreich: "Frankreich",
    it: "Italien",
    ita: "Italien",
    italien: "Italien",
  }
  return displayNames[normalized] ?? raw
}

export type PdfDocumentPayment = {
  amount: number
  reference: string
  qrImageUrl?: string | null
  /** Bereits online bezahlt (Karte / TWINT) */
  alreadyPaid?: boolean
  paymentMethodLabel?: string
}

export type PdfDocumentLayoutProps = {
  title: string
  template: DocumentTemplateSettings
  documentText: DocumentTypeTextSettings
  documentType?: DocumentTemplateType
  recipient: PdfDocumentRecipient
  documentMeta: PdfDocumentMeta
  placeholderValues: Record<string, string>
  payment?: PdfDocumentPayment | null
  children: ReactNode
}

function logoJustifyContent(alignment: DocumentLogoAlignment) {
  if (alignment === "left") return "flex-start"
  if (alignment === "center") return "center"
  return "flex-end"
}

type LayoutStyles = ReturnType<typeof createPdfDocumentLayoutStyles>

function PdfLogoHeader({
  styles,
  logoUrl,
  alignment,
}: {
  styles: LayoutStyles
  logoUrl?: string
  alignment: DocumentLogoAlignment
}) {
  return (
    <View
      fixed
      style={[
        styles.logoHeader,
        { flexDirection: "row", justifyContent: logoJustifyContent(alignment) },
      ]}
    >
      {logoUrl ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image
        <Image style={styles.logo} src={logoUrl} />
      ) : null}
    </View>
  )
}

function PdfCenterFooter({
  styles,
  footerLines,
}: {
  styles: LayoutStyles
  footerLines: { line1: string; line2: string; line3: string }
}) {
  const hasFooter = footerLines.line1 || footerLines.line2 || footerLines.line3
  if (!hasFooter) return null
  return (
    <View style={styles.centerFooter} fixed>
      {footerLines.line1 ? (
        <Text style={styles.footerLine1}>{footerLines.line1}</Text>
      ) : null}
      {footerLines.line2 ? (
        <Text style={styles.footerLine2}>{footerLines.line2}</Text>
      ) : null}
      {footerLines.line3 ? (
        <Text style={styles.footerLine3}>{footerLines.line3}</Text>
      ) : null}
    </View>
  )
}

export function PdfDocumentLayout({
  title,
  template,
  documentText,
  documentType = "invoice",
  recipient,
  documentMeta,
  placeholderValues,
  payment,
  children,
}: PdfDocumentLayoutProps) {
  const styles = createPdfDocumentLayoutStyles(template)
  const infoLabels = resolvePdfInfoPanelLabels(documentType)
  const logoUrl = template.logoUrl ?? undefined
  const headerLine = sanitizePdfText(
    applyDocumentTemplatePlaceholders(documentText.headerLine, placeholderValues)
  )
  const referenceLine = sanitizePdfText(
    applyDocumentTemplatePlaceholders(
      documentText.referenceLine,
      placeholderValues
    )
  )
  const introText = sanitizePdfText(
    applyDocumentTemplatePlaceholders(documentText.introText, placeholderValues)
  )
  const footerNote = sanitizePdfText(
    applyDocumentTemplatePlaceholders(documentText.footerNote, placeholderValues)
  )
  const paymentBlockText = sanitizePdfText(
    applyDocumentTemplatePlaceholders(
      documentText.paymentBlockText,
      placeholderValues
    )
  )
  const customFooter = sanitizePdfText(
    applyDocumentTemplatePlaceholders(
      documentText.centerFooterText,
      placeholderValues
    )
  )
  const footerLinesRaw = resolveDocumentFooterLines(template, customFooter)
  const footerLines = {
    line1: sanitizePdfText(footerLinesRaw.line1),
    line2: sanitizePdfText(footerLinesRaw.line2),
    line3: sanitizePdfText(footerLinesRaw.line3),
  }
  const accountHolder = sanitizePdfText(resolveKontoinhaber(template))
  const alreadyPaid = Boolean(payment?.alreadyPaid)
  const showPaymentPage = documentText.showPaymentBlock && Boolean(payment)
  const qrImageUrl = payment?.qrImageUrl ?? template.qrPaymentImageUrl
  const paymentMethodLabel = sanitizePdfText(
    payment?.paymentMethodLabel?.trim() || "Online-Zahlung"
  )
  const receiptMessage = sanitizePdfText(
    `Dieser Beleg dient als Quittung. Der Betrag wurde bereits erfolgreich via ${paymentMethodLabel} beglichen. Vielen Dank!`
  )
  const recipientCountry = formatPdfRecipientCountry(recipient.country)
  const recipientName = sanitizePdfText(
    `${recipient.firstName} ${recipient.lastName}`
  )
  const recipientStreet = sanitizePdfText(recipient.street)
  const recipientCityLine = sanitizePdfText(
    `${recipient.zip} ${recipient.city}`
  )

  return (
    <Document title={title} author={template.firmenname}>
      <Page size="A4" style={styles.page}>
        <PdfLogoHeader
          styles={styles}
          logoUrl={logoUrl}
          alignment={template.logoAlignment}
        />

        <View style={styles.recipientBlock}>
          <Text style={styles.recipientLine}>{recipientName}</Text>
          <Text style={styles.recipientLine}>{recipientStreet}</Text>
          <Text style={styles.recipientLine}>{recipientCityLine}</Text>
          {recipientCountry ? (
            <Text style={styles.recipientLine}>
              {sanitizePdfText(recipientCountry)}
            </Text>
          ) : null}
        </View>

        <View style={styles.infoPanel}>
          <View style={styles.infoField}>
            <Text style={styles.infoLabel}>
              {sanitizePdfText(infoLabels.number)}
            </Text>
            <Text style={styles.infoValue}>
              {sanitizePdfText(documentMeta.documentNumber)}
            </Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.infoLabel}>
              {sanitizePdfText(infoLabels.date)}
            </Text>
            <Text style={styles.infoValue}>
              {sanitizePdfText(documentMeta.documentDate)}
            </Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.infoLabel}>
              {sanitizePdfText(infoLabels.terms)}
            </Text>
            <Text style={styles.infoValue}>
              {sanitizePdfText(documentMeta.paymentTermsLabel)}
            </Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.infoLabel}>
              {sanitizePdfText(infoLabels.due)}
            </Text>
            <Text style={styles.infoValue}>
              {sanitizePdfText(documentMeta.dueDate)}
            </Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.infoLabel}>
              {sanitizePdfText(infoLabels.shipping)}
            </Text>
            <Text style={styles.infoValue}>
              {sanitizePdfText(documentMeta.shippingLabel)}
            </Text>
          </View>
        </View>

        <View style={styles.headerRule} />
        <View style={styles.headerAccent} />
        <Text style={styles.headerLine}>{headerLine}</Text>
        {referenceLine ? (
          <Text style={styles.referenceLine}>{referenceLine}</Text>
        ) : null}
        {introText ? <Text style={styles.introText}>{introText}</Text> : null}

        {children}

        {footerNote ? <Text style={styles.footerNote}>{footerNote}</Text> : null}

        {alreadyPaid ? (
          <View style={styles.receiptNotice}>
            <Text style={styles.receiptNoticeText}>{receiptMessage}</Text>
          </View>
        ) : null}

        {/* Fixer Footer auf allen Seiten (inkl. Folgeseiten) */}
        <PdfCenterFooter styles={styles} footerLines={footerLines} />
      </Page>

      {showPaymentPage && payment ? (
        <Page size="A4" style={styles.paymentPage}>
          <PdfLogoHeader
            styles={styles}
            logoUrl={logoUrl}
            alignment={template.logoAlignment}
          />
          <PdfCenterFooter styles={styles} footerLines={footerLines} />

          <View style={styles.paymentBottomContainer}>
            {!alreadyPaid && paymentBlockText ? (
              <Text style={styles.paymentInstructionTop}>{paymentBlockText}</Text>
            ) : null}

            <View style={styles.paymentDashLine} />

            {alreadyPaid ? (
              <View style={styles.paidStampWrap}>
                <Text style={styles.paidStamp}>BEZAHLT / PAID</Text>
                <Text style={styles.paidStampSub}>{receiptMessage}</Text>
              </View>
            ) : (
              <View style={styles.paymentSection}>
                <View style={styles.paymentLeft}>
                  <Text style={styles.paymentSectionTitle}>Zahlungsverbindung</Text>
                  <Text style={styles.paymentLineBold}>Kontoinhaber</Text>
                  <Text style={styles.paymentLine}>{accountHolder}</Text>
                  {template.iban ? (
                    <>
                      <Text style={[styles.paymentLineBold, { marginTop: 6 }]}>IBAN</Text>
                      <Text style={styles.paymentLine}>
                        {sanitizePdfText(template.iban)}
                      </Text>
                    </>
                  ) : null}
                  {template.bankname ? (
                    <Text style={styles.paymentLine}>
                      {sanitizePdfText(template.bankname)}
                    </Text>
                  ) : null}
                  <Text style={[styles.paymentLineBold, { marginTop: 6 }]}>
                    Referenz / Zahlungszweck
                  </Text>
                  <Text style={styles.paymentLine}>
                    {sanitizePdfText(payment.reference)}
                  </Text>
                </View>
                <View style={styles.paymentRightColumn}>
                  {qrImageUrl ? (
                    // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image
                    <Image style={styles.qrImage} src={qrImageUrl} />
                  ) : null}
                  <Text style={styles.paymentAmount}>
                    {sanitizePdfText(formatChf(payment.amount))}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </Page>
      ) : null}
    </Document>
  )
}
