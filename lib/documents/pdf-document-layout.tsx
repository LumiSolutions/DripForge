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
/** Platz am unteren Rand für den fixen Footer (3 Zeilen + Abstand). */
const FOOTER_RESERVED_MM = 28
const FOOTER_BOTTOM_OFFSET_MM = 10

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
  paidGreenBg: "#f0fdf4",
  paidGreenBorder: "#86efac",
  paidGreenDark: "#166534",
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
      lineHeight: 1.5,
      paddingTop: pagePaddingTop,
      paddingHorizontal: 20 * MM,
      paddingBottom: FOOTER_RESERVED_MM * MM,
      hyphens: "none",
    },
    paymentPage: {
      fontFamily: font,
      fontSize: base,
      color: pdfDocumentColors.anthracite,
      lineHeight: 1.5,
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
      alignItems: "center",
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
      marginBottom: 14,
      maxWidth: "52%",
      fontSize: scaledSize(base, 10),
      lineHeight: 1.5,
      hyphens: "none",
    },
    recipientHeading: {
      ...bold,
      fontSize: scaledSize(base, 8),
      textTransform: "uppercase",
      letterSpacing: 0.7,
      color: pdfDocumentColors.anthraciteMid,
      marginBottom: 6,
      hyphens: "none",
    },
    recipientLine: {
      marginBottom: 2,
      hyphens: "none",
    },
    infoPanel: {
      flexDirection: "row",
      backgroundColor: pdfDocumentColors.infoPanel,
      borderRadius: 3,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: pdfDocumentColors.border,
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
      hyphens: "none",
    },
    infoValue: {
      fontSize: scaledSize(base, 8.5),
      ...bold,
      color: pdfDocumentColors.anthracite,
      hyphens: "none",
    },
    headerRule: {
      height: 1,
      backgroundColor: pdfDocumentColors.border,
      marginBottom: 8,
      marginTop: 2,
    },
    headerAccent: {
      height: 2,
      width: 48,
      backgroundColor: pdfDocumentColors.orange,
      marginBottom: 12,
    },
    headerLine: {
      ...bold,
      fontSize: scaledSize(base, 13),
      color: pdfDocumentColors.anthracite,
      marginBottom: 6,
      hyphens: "none",
    },
    referenceLine: {
      fontSize: scaledSize(base, 9.5),
      color: pdfDocumentColors.anthraciteMid,
      marginBottom: 10,
      lineHeight: 1.45,
      hyphens: "none",
    },
    introText: {
      fontSize: scaledSize(base, 9.5),
      color: pdfDocumentColors.anthraciteLight,
      marginBottom: 16,
      maxWidth: "90%",
      lineHeight: 1.5,
      hyphens: "none",
    },
    footerNote: {
      fontSize: scaledSize(base, 9),
      color: pdfDocumentColors.anthraciteLight,
      marginTop: 12,
      maxWidth: "90%",
      lineHeight: 1.5,
      hyphens: "none",
    },
    receiptNotice: {
      marginTop: 18,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1.5,
      borderColor: pdfDocumentColors.paidGreenBorder,
      borderRadius: 6,
      backgroundColor: pdfDocumentColors.paidGreenBg,
      alignItems: "center",
    },
    receiptNoticeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    receiptNoticeText: {
      fontSize: scaledSize(base, 9.5),
      color: pdfDocumentColors.paidGreenDark,
      lineHeight: 1.5,
      textAlign: "center",
      ...bold,
    },
    paymentInstructionTop: {
      fontSize: scaledSize(base, 8.5),
      color: "#4a5568",
      textAlign: "center",
      marginBottom: 10,
      lineHeight: 1.35,
      width: "100%",
    },
    paymentDashLine: {
      borderTopWidth: 1,
      borderTopColor: pdfDocumentColors.anthraciteMid,
      borderStyle: "dashed",
      marginTop: 0,
      marginBottom: 14,
      width: "100%",
      alignSelf: "stretch",
    },
    paymentSection: {
      marginTop: 0,
      flexDirection: "row",
      alignItems: "flex-start",
      width: "100%",
      alignSelf: "stretch",
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
      width: "100%",
      marginTop: 4,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 18,
      paddingHorizontal: 16,
      borderWidth: 1.5,
      borderColor: pdfDocumentColors.paidGreenBorder,
      borderRadius: 8,
      backgroundColor: pdfDocumentColors.paidGreenBg,
    },
    paidStatusHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    paidCheckDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: pdfDocumentColors.paidGreen,
      marginRight: 10,
    },
    paidStamp: {
      ...bold,
      fontSize: scaledSize(base, 18),
      color: pdfDocumentColors.paidGreenDark,
      letterSpacing: 1.2,
      textAlign: "center",
    },
    paidRefLine: {
      marginTop: 2,
      marginBottom: 10,
      textAlign: "center",
      fontSize: scaledSize(base, 9),
      color: pdfDocumentColors.anthraciteMid,
      lineHeight: 1.45,
    },
    paidRefLabel: {
      color: pdfDocumentColors.anthraciteMid,
    },
    paidRefId: {
      ...bold,
      color: pdfDocumentColors.anthracite,
    },
    paidStampSub: {
      marginTop: 2,
      fontSize: scaledSize(base, 9.5),
      color: pdfDocumentColors.paidGreenDark,
      textAlign: "center",
      maxWidth: "92%",
      lineHeight: 1.5,
    },
    /**
     * Fixer Footer am unteren Rand — erscheint auf JEDER Seite (`fixed`).
     * Mehrzeilig (Firma | Adresse | Kontakt), zentriert, dezentes Grau.
     * Feste Elemente möglichst früh im Page-Tree platzieren (react-pdf).
     */
    centerFooter: {
      position: "absolute",
      bottom: FOOTER_BOTTOM_OFFSET_MM * MM,
      left: 20 * MM,
      right: 20 * MM,
      textAlign: "center",
      lineHeight: 1.35,
      hyphens: "none",
    },
    footerLine1: {
      ...bold,
      fontSize: 9,
      color: pdfDocumentColors.anthraciteLight,
      marginBottom: 2,
      lineHeight: 1.35,
      textAlign: "center",
      hyphens: "none",
    },
    footerLine2: {
      fontSize: 9,
      color: pdfDocumentColors.anthraciteLight,
      marginBottom: 2,
      lineHeight: 1.35,
      textAlign: "center",
      hyphens: "none",
    },
    footerLine3: {
      fontSize: 9,
      color: pdfDocumentColors.anthraciteLight,
      lineHeight: 1.35,
      textAlign: "center",
      hyphens: "none",
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
  /** Stripe Session-ID oder andere Gateway-Referenz */
  paymentProviderRef?: string | null
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
  const paymentProviderRef = sanitizePdfText(
    payment?.paymentProviderRef?.trim() || ""
  )
  const isStripePayment =
    /stripe|kreditkarte|card/i.test(paymentMethodLabel) ||
    Boolean(payment?.paymentProviderRef?.trim()?.startsWith("cs_"))
  const receiptMessage = sanitizePdfText(
    isStripePayment
      ? "Ihre Zahlung wurde erfolgreich über Stripe abgewickelt. Vielen Dank!"
      : `Ihre Zahlung wurde erfolgreich via ${paymentMethodLabel} abgewickelt. Vielen Dank!`
  )
  const receiptNoticeMessage = sanitizePdfText(
    `Dieser Beleg dient als Quittung. Der Betrag wurde bereits erfolgreich via ${paymentMethodLabel} beglichen.`
  )
  const paidRefCaption = isStripePayment
    ? "Stripe-Referenz"
    : "Zahlungsreferenz"
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
        {/* fixed-Elemente zuerst: erscheinen zuverlässig auf allen Folgeseiten */}
        <PdfLogoHeader
          styles={styles}
          logoUrl={logoUrl}
          alignment={template.logoAlignment}
        />
        <PdfCenterFooter styles={styles} footerLines={footerLines} />

        <View style={styles.recipientBlock}>
          <Text style={styles.recipientHeading}>Empfänger</Text>
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
            <View style={styles.receiptNoticeRow}>
              <View style={styles.paidCheckDot} />
              <Text style={styles.receiptNoticeText}>Bezahlt / Paid</Text>
            </View>
            <Text style={styles.receiptNoticeText}>{receiptNoticeMessage}</Text>
          </View>
        ) : null}
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

            {!alreadyPaid ? <View style={styles.paymentDashLine} /> : null}

            {alreadyPaid ? (
              <View style={styles.paidStampWrap}>
                <View style={styles.paidStatusHeader}>
                  <View style={styles.paidCheckDot} />
                  <Text style={styles.paidStamp}>Bezahlt / Paid</Text>
                </View>
                {paymentProviderRef ? (
                  <Text style={styles.paidRefLine}>
                    <Text style={styles.paidRefLabel}>{paidRefCaption}: </Text>
                    <Text style={styles.paidRefId}>{paymentProviderRef}</Text>
                  </Text>
                ) : payment.reference ? (
                  <Text style={styles.paidRefLine}>
                    <Text style={styles.paidRefLabel}>Bestellreferenz: </Text>
                    <Text style={styles.paidRefId}>
                      {sanitizePdfText(payment.reference)}
                    </Text>
                  </Text>
                ) : null}
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
