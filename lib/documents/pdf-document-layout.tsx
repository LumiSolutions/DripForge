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
  getPaymentPageCompanyLines,
  resolveDocumentFooterLines,
  type DocumentLogoAlignment,
  type DocumentTemplateSettings,
  type DocumentTypeTextSettings,
} from "@/lib/documents/document-template-types"
import { pdfBoldStyle, resolvePdfFontFamily } from "@/lib/documents/pdf-fonts"
import { formatChf } from "@/lib/invoices/invoice-format"

const MM = 2.834645669
const PDF_CONTENT_WIDTH_MM = 170

export const pdfDocumentColors = {
  anthracite: "#1f2937",
  anthraciteMid: "#374151",
  anthraciteLight: "#6b7280",
  orange: "#f97316",
  border: "#e5e7eb",
  bgMuted: "#f8fafc",
  infoPanel: "#f3f4f6",
  tableHeader: "#1e293b",
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

  return StyleSheet.create({
    page: {
      fontFamily: font,
      fontSize: base,
      color: pdfDocumentColors.anthracite,
      lineHeight: 1.4,
      paddingTop: 0,
      paddingHorizontal: 20 * MM,
      paddingBottom: 32,
    },
    paymentPage: {
      fontFamily: font,
      fontSize: base,
      color: pdfDocumentColors.anthracite,
      lineHeight: 1.4,
      paddingTop: 0,
      paddingHorizontal: 20 * MM,
      paddingBottom: 40,
      position: "relative",
    },
    /** Zahlungsblock am unteren Blattrand (Abstand ~40pt zum Rand) */
    paymentBottomContainer: {
      position: "absolute",
      bottom: 40,
      left: 20 * MM,
      right: 20 * MM,
      backgroundColor: "transparent",
    },
    logoHeader: {
      height: DOCUMENT_HEADER_HEIGHT_MM * MM,
      marginBottom: 0,
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
    paymentPageCompany: {
      marginTop: 0,
      marginBottom: 10,
      alignItems: "center",
    },
    paymentPageCompanyLine: {
      fontSize: scaledSize(base, 10),
      color: pdfDocumentColors.anthracite,
      marginBottom: 2,
      textAlign: "center",
    },
    paymentPageCompanyBold: {
      ...bold,
      fontSize: scaledSize(base, 11),
      color: pdfDocumentColors.anthracite,
      marginBottom: 3,
      textAlign: "center",
    },
    paymentDashLine: {
      borderTopWidth: 1,
      borderTopColor: pdfDocumentColors.anthraciteMid,
      borderStyle: "dashed",
      marginTop: 4,
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
    paymentNote: {
      fontSize: scaledSize(base, 7.5),
      color: pdfDocumentColors.anthraciteLight,
      lineHeight: 1.35,
      marginTop: 5,
      textAlign: "center",
      maxWidth: 52 * MM,
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
    centerFooter: {
      position: "absolute",
      bottom: 20 * MM,
      left: 20 * MM,
      right: 20 * MM,
      textAlign: "center",
      lineHeight: 1.4,
    },
    footerLine1: {
      ...bold,
      fontSize: scaledSize(base, 7.5),
      color: pdfDocumentColors.anthraciteMid,
      marginBottom: 2,
    },
    footerLine2: {
      fontSize: scaledSize(base, 7),
      color: pdfDocumentColors.anthraciteLight,
      marginBottom: 2,
    },
    footerLine3: {
      fontSize: scaledSize(base, 7),
      color: pdfDocumentColors.anthraciteLight,
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
  // Ohne `fixed`: nur auf dieser Seite (nicht auf Folgeseiten wiederholen)
  return (
    <View style={styles.centerFooter}>
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
  recipient,
  documentMeta,
  placeholderValues,
  payment,
  children,
}: PdfDocumentLayoutProps) {
  const styles = createPdfDocumentLayoutStyles(template)
  const logoUrl = template.logoUrl ?? undefined
  const headerLine = applyDocumentTemplatePlaceholders(
    documentText.headerLine,
    placeholderValues
  )
  const referenceLine = applyDocumentTemplatePlaceholders(
    documentText.referenceLine,
    placeholderValues
  )
  const introText = applyDocumentTemplatePlaceholders(
    documentText.introText,
    placeholderValues
  )
  const footerNote = applyDocumentTemplatePlaceholders(
    documentText.footerNote,
    placeholderValues
  )
  const paymentBlockText = applyDocumentTemplatePlaceholders(
    documentText.paymentBlockText,
    placeholderValues
  )
  const customFooter = applyDocumentTemplatePlaceholders(
    documentText.centerFooterText,
    placeholderValues
  )
  const footerLines = resolveDocumentFooterLines(template, customFooter)
  const accountHolder = template.inhaber
    ? `${template.firmenname}\n${template.inhaber}`
    : template.firmenname
  const alreadyPaid = Boolean(payment?.alreadyPaid)
  const showPaymentPage = documentText.showPaymentBlock && Boolean(payment)
  const qrImageUrl = payment?.qrImageUrl ?? template.qrPaymentImageUrl
  const paymentMethodLabel =
    payment?.paymentMethodLabel?.trim() || "Online-Zahlung"
  const receiptMessage = `Dieser Beleg dient als Quittung. Der Betrag wurde bereits erfolgreich via ${paymentMethodLabel} beglichen. Vielen Dank!`

  const companyLines = getPaymentPageCompanyLines(template)

  return (
    <Document title={title} author={template.firmenname}>
      <Page size="A4" style={styles.page}>
        <PdfLogoHeader
          styles={styles}
          logoUrl={logoUrl}
          alignment={template.logoAlignment}
        />

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

        <View style={styles.infoPanel}>
          <View style={styles.infoField}>
            <Text style={styles.infoLabel}>Rechnungsnummer</Text>
            <Text style={styles.infoValue}>{documentMeta.documentNumber}</Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.infoLabel}>Rechnungsdatum</Text>
            <Text style={styles.infoValue}>{documentMeta.documentDate}</Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.infoLabel}>Zahlungsfrist</Text>
            <Text style={styles.infoValue}>{documentMeta.paymentTermsLabel}</Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.infoLabel}>Faelligkeitsdatum</Text>
            <Text style={styles.infoValue}>{documentMeta.dueDate}</Text>
          </View>
          <View style={styles.infoField}>
            <Text style={styles.infoLabel}>Versandart</Text>
            <Text style={styles.infoValue}>{documentMeta.shippingLabel}</Text>
          </View>
        </View>

        <View style={styles.headerRule} />
        <View style={styles.headerAccent} />
        <Text style={styles.headerLine}>{headerLine}</Text>
        {referenceLine ? <Text style={styles.referenceLine}>{referenceLine}</Text> : null}
        {introText ? <Text style={styles.introText}>{introText}</Text> : null}

        {children}

        {footerNote ? <Text style={styles.footerNote}>{footerNote}</Text> : null}

        {alreadyPaid ? (
          <View style={styles.receiptNotice}>
            <Text style={styles.receiptNoticeText}>{receiptMessage}</Text>
          </View>
        ) : null}

        {/* Footer nur auf Seite 1 */}
        <PdfCenterFooter styles={styles} footerLines={footerLines} />
      </Page>

      {showPaymentPage && payment ? (
        <Page size="A4" style={styles.paymentPage}>
          <PdfLogoHeader
            styles={styles}
            logoUrl={logoUrl}
            alignment={template.logoAlignment}
          />

          <View style={styles.paymentBottomContainer}>
            <View style={styles.paymentPageCompany}>
              {companyLines.map((line, index) => (
                <Text
                  key={`${line}-${index}`}
                  style={
                    index === 0
                      ? styles.paymentPageCompanyBold
                      : styles.paymentPageCompanyLine
                  }
                >
                  {line}
                </Text>
              ))}
            </View>

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
                      <Text style={styles.paymentLine}>{template.iban}</Text>
                    </>
                  ) : null}
                  {template.bankname ? (
                    <Text style={styles.paymentLine}>{template.bankname}</Text>
                  ) : null}
                  <Text style={[styles.paymentLineBold, { marginTop: 6 }]}>
                    Referenz / Zahlungszweck
                  </Text>
                  <Text style={styles.paymentLine}>{payment.reference}</Text>
                </View>
                <View style={styles.paymentRightColumn}>
                  {qrImageUrl ? (
                    // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image
                    <Image style={styles.qrImage} src={qrImageUrl} />
                  ) : null}
                  <Text style={styles.paymentAmount}>{formatChf(payment.amount)}</Text>
                  {paymentBlockText ? (
                    <Text style={styles.paymentNote}>{paymentBlockText}</Text>
                  ) : null}
                </View>
              </View>
            )}
          </View>
        </Page>
      ) : null}
    </Document>
  )
}
