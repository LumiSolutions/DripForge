"use client"

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer"
import { ensureDocumentPdfFonts } from "@/lib/documents/pdf-fonts"

export type AccountingPdfColumn = {
  key: string
  header: string
  /** Flex width relative to other columns (default 1). */
  width?: number
  align?: "left" | "right" | "center"
}

export type AccountingPdfOptions = {
  title: string
  subtitle?: string
  filename: string
  columns: AccountingPdfColumn[]
  rows: Array<Record<string, string | number | null | undefined>>
  landscape?: boolean
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontFamily: "Inter",
    fontSize: 8,
    color: "#18181b",
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: "#52525b",
    marginBottom: 16,
  },
  table: {
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
    paddingBottom: 4,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e4e4e7",
    paddingVertical: 3,
  },
  cell: {
    paddingRight: 6,
  },
  headerCell: {
    fontWeight: 700,
    paddingRight: 6,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#71717a",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  empty: {
    marginTop: 24,
    color: "#71717a",
  },
})

function AccountingTableDocument({
  title,
  subtitle,
  columns,
  rows,
  landscape,
}: Omit<AccountingPdfOptions, "filename">) {
  const totalWidth = columns.reduce((sum, col) => sum + (col.width ?? 1), 0)

  return (
    <Document title={title}>
      <Page
        size="A4"
        orientation={landscape ? "landscape" : "portrait"}
        style={styles.page}
      >
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {rows.length === 0 ? (
          <Text style={styles.empty}>Keine Daten vorhanden.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.headerRow} fixed>
              {columns.map((col) => (
                <Text
                  key={col.key}
                  style={[
                    styles.headerCell,
                    {
                      width: `${((col.width ?? 1) / totalWidth) * 100}%`,
                      textAlign: col.align ?? "left",
                    },
                  ]}
                >
                  {col.header}
                </Text>
              ))}
            </View>
            {rows.map((row, index) => (
              <View key={index} style={styles.row} wrap={false}>
                {columns.map((col) => {
                  const value = row[col.key]
                  return (
                    <Text
                      key={col.key}
                      style={[
                        styles.cell,
                        {
                          width: `${((col.width ?? 1) / totalWidth) * 100}%`,
                          textAlign: col.align ?? "left",
                        },
                      ]}
                    >
                      {value == null ? "" : String(value)}
                    </Text>
                  )
                })}
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>Dipforge Buchhaltung</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Seite ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Client-seitiger PDF-Export für Buchhaltungs-Tabellen via @react-pdf/renderer. */
export async function downloadAccountingPdf(
  options: AccountingPdfOptions
): Promise<void> {
  ensureDocumentPdfFonts()

  const blob = await pdf(
    <AccountingTableDocument
      title={options.title}
      subtitle={options.subtitle}
      columns={options.columns}
      rows={options.rows}
      landscape={options.landscape}
    />
  ).toBlob()

  triggerBlobDownload(blob, options.filename)
}
