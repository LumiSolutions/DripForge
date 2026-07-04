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
  type DocumentTemplateSettings,
  type DocumentTypeTextSettings,
} from "@/lib/documents/document-template-types"
import { formatChf } from "@/lib/invoices/invoice-format"

const MM = 2.834645669

export const pdfDocumentColors = {
  anthracite: "#1f2937",
  anthraciteMid: "#374151",
  anthraciteLight: "#6b7280",
  orange: "#f97316",
  orangeSoft: "#fff7ed",
  border: "#e5e7eb",
  bgMuted: "#f8fafc",
  tableHeader: "#1e293b",
}

const ENVELOPE_LEFT = 20 * MM
const ENVELOPE_WINDOW_TOP = 45 * MM
const ENVELOPE_RETURN_TOP = 22 * MM
const ENVELOPE_WIDTH = 90 * MM
const PAYMENT_BLOCK_HEIGHT = 105 * MM

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: pdfDocumentColors.anthracite,
    lineHeight: 1.4,
    paddingBottom: PAYMENT_BLOCK_HEIGHT + 36,
  },
  returnAddress: {
    position: "absolute",
    top: ENVELOPE_RETURN_TOP,
    left: ENVELOPE_LEFT,
    width: ENVELOPE_WIDTH,
    fontSize: 7,
    color: pdfDocumentColors.anthraciteLight,
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
    color: pdfDocumentColors.anthraciteMid,
  },
  dateLabel: {
    fontSize: 7.5,
    color: pdfDocumentColors.anthraciteLight,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  dateValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: pdfDocumentColors.anthracite,
  },
  body: {
    marginTop: 92 * MM,
    paddingHorizontal: 20 * MM,
  },
  headerRule: {
    height: 1,
    backgroundColor: pdfDocumentColors.border,
    marginBottom: 14,
  },
  headerAccent: {
    height: 2,
    width: 48,
    backgroundColor: pdfDocumentColors.orange,
    marginBottom: 12,
  },
  headerLine: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: pdfDocumentColors.anthracite,
    marginBottom: 4,
  },
  referenceLine: {
    fontSize: 9.5,
    color: pdfDocumentColors.anthraciteMid,
    marginBottom: 8,
  },
  introText: {
    fontSize: 9.5,
    color: pdfDocumentColors.anthraciteLight,
    marginBottom: 18,
    maxWidth: "85%",
  },
  paymentBlock: {
    position: "absolute",
    bottom: 22,
    left: 0,
    right: 0,
    height: PAYMENT_BLOCK_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: pdfDocumentColors.anthracite,
    flexDirection: "row",
    paddingTop: 10,
    paddingHorizontal: 20 * MM,
    backgroundColor: pdfDocumentColors.orangeSoft,
  },
  paymentLeft: {
    flex: 1,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: pdfDocumentColors.border,
    justifyContent: "flex-start",
  },
  paymentSectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: pdfDocumentColors.orange,
    marginBottom: 8,
  },
  paymentLine: {
    fontSize: 8.5,
    marginBottom: 3,
    color: pdfDocumentColors.anthraciteMid,
  },
  paymentLineBold: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: pdfDocumentColors.anthracite,
    marginBottom: 4,
  },
  paymentAmount: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: pdfDocumentColors.anthracite,
    marginTop: 6,
    marginBottom: 8,
  },
  paymentNote: {
    fontSize: 7.5,
    color: pdfDocumentColors.anthraciteLight,
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
    color: pdfDocumentColors.anthraciteLight,
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
    color: pdfDocumentColors.anthraciteLight,
  },
})

export type PdfDocumentRecipient = {
  firstName: string
  lastName: string
  street: string
  zip: string
  city: string
  country: string
}

export type PdfDocumentPayment = {
  amount: number
  reference: string
  qrDataUrl?: string | null
}

export type PdfDocumentLayoutProps = {
  title: string
  template: DocumentTemplateSettings
  documentText: DocumentTypeTextSettings
  recipient: PdfDocumentRecipient
  date: string
  placeholderValues: Record<string, string>
  payment?: PdfDocumentPayment | null
  children: ReactNode
}

function buildReturnAddress(template: DocumentTemplateSettings): string {
  const lines = template.firmenAdresse.split("\n").filter(Boolean)
  const cityLine = lines.slice(1).join(", ") || lines[0] || ""
  return `${template.firmenname} · ${cityLine}`.trim()
}

export function PdfDocumentLayout({
  title,
  template,
  documentText,
  recipient,
  date,
  placeholderValues,
  payment,
  children,
}: PdfDocumentLayoutProps) {
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
  const centerFooterText = applyDocumentTemplatePlaceholders(
    documentText.centerFooterText,
    placeholderValues
  )
  const accountHolder = template.inhaber
    ? `${template.firmenname}\n${template.inhaber}`
    : template.firmenname
  const showPaymentBlock = documentText.showPaymentBlock && Boolean(payment)

  return (
    <Document title={title} author={template.firmenname}>
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
          <Text style={styles.dateValue}>{date}</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.headerRule} />
          <View style={styles.headerAccent} />
          <Text style={styles.headerLine}>{headerLine}</Text>
          {referenceLine ? <Text style={styles.referenceLine}>{referenceLine}</Text> : null}
          {introText ? <Text style={styles.introText}>{introText}</Text> : null}
          {children}
          {footerNote ? (
            <Text style={[styles.introText, { marginBottom: 0 }]}>{footerNote}</Text>
          ) : null}
        </View>

        {showPaymentBlock && payment ? (
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
              <Text style={styles.paymentLine}>{payment.reference}</Text>
              <Text style={styles.paymentAmount}>{formatChf(payment.amount)}</Text>
              {paymentBlockText ? (
                <Text style={styles.paymentNote}>{paymentBlockText}</Text>
              ) : null}
            </View>
            <View style={styles.paymentRight}>
              {payment.qrDataUrl ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image */}
                  <Image style={styles.qrImage} src={payment.qrDataUrl} />
                  <Text style={styles.qrLabel}>Swiss QR-Zahlteil</Text>
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
