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
  buildDocumentFooterText,
  type DocumentLogoAlignment,
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
  border: "#e5e7eb",
  bgMuted: "#f8fafc",
  infoPanel: "#f3f4f6",
  tableHeader: "#1e293b",
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: pdfDocumentColors.anthracite,
    lineHeight: 1.4,
    paddingTop: 15 * MM,
    paddingHorizontal: 20 * MM,
    paddingBottom: 32,
  },
  logoHeader: {
    marginBottom: 14,
    minHeight: 22 * MM,
    justifyContent: "center",
  },
  logo: {
    width: 22 * MM,
    height: 22 * MM,
    objectFit: "contain",
  },
  recipientBlock: {
    marginBottom: 10,
    maxWidth: "52%",
    fontSize: 10,
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
    fontSize: 6.5,
    color: pdfDocumentColors.anthraciteLight,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
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
    marginBottom: 14,
    maxWidth: "90%",
  },
  footerNote: {
    fontSize: 9,
    color: pdfDocumentColors.anthraciteLight,
    marginTop: 8,
    maxWidth: "90%",
  },
  paymentSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: pdfDocumentColors.border,
    paddingTop: 12,
    flexDirection: "row",
  },
  paymentLeft: {
    flex: 1,
    paddingRight: 12,
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
    justifyContent: "flex-start",
  },
  qrImage: {
    width: 46 * MM,
    height: 46 * MM,
    objectFit: "contain",
  },
  centerFooter: {
    position: "absolute",
    bottom: 10,
    left: 20 * MM,
    right: 20 * MM,
    textAlign: "center",
    fontSize: 7,
    color: pdfDocumentColors.anthraciteLight,
    lineHeight: 1.35,
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
  const footerText = customFooter.trim() || buildDocumentFooterText(template)
  const accountHolder = template.inhaber
    ? `${template.firmenname}\n${template.inhaber}`
    : template.firmenname
  const showPaymentBlock = documentText.showPaymentBlock && Boolean(payment)
  const qrImageUrl = payment?.qrImageUrl ?? template.qrPaymentImageUrl

  return (
    <Document title={title} author={template.firmenname}>
      <Page size="A4" style={styles.page}>
        <View
          style={[
            styles.logoHeader,
            { flexDirection: "row", justifyContent: logoJustifyContent(template.logoAlignment) },
          ]}
        >
          {logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image
            <Image style={styles.logo} src={logoUrl} />
          ) : null}
        </View>

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

        {showPaymentBlock && payment ? (
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
              <Text style={styles.paymentAmount}>{formatChf(payment.amount)}</Text>
              {paymentBlockText ? (
                <Text style={styles.paymentNote}>{paymentBlockText}</Text>
              ) : null}
            </View>
            {qrImageUrl ? (
              <View style={styles.paymentRight}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image */}
                <Image style={styles.qrImage} src={qrImageUrl} />
              </View>
            ) : null}
          </View>
        ) : null}

        {footerText ? (
          <Text style={styles.centerFooter} fixed>
            {footerText}
          </Text>
        ) : null}
      </Page>
    </Document>
  )
}
