export type CustomerDocumentRow = {
  id: string
  orderId: string
  type: "rechnung" | "offerte" | "auftragsbestaetigung" | "lieferschein" | "gutschrift"
  label: string
  createdAt: string
  downloadUrl: string | null
  available: boolean
}
