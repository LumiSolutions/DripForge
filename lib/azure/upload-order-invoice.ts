import { BlobServiceClient } from "@azure/storage-blob"

const INVOICE_CONTAINER = "order-invoices"

export async function uploadOrderInvoicePdf(
  orderId: string,
  buffer: Buffer
): Promise<string | null> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!connectionString) {
    console.warn(
      "Rechnungs-Speicher: AZURE_STORAGE_CONNECTION_STRING fehlt — Upload übersprungen."
    )
    return null
  }

  try {
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient = blobServiceClient.getContainerClient(INVOICE_CONTAINER)
    await containerClient.createIfNotExists({ access: "blob" })

    const safeOrderId = orderId.replace(/[^a-zA-Z0-9-_]/g, "_")
    const blobName = `${safeOrderId}/rechnung.pdf`
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: "application/pdf" },
    })

    return blockBlobClient.url
  } catch (error) {
    console.warn("Rechnungs-Speicher: Azure-Upload fehlgeschlagen.", error)
    return null
  }
}
