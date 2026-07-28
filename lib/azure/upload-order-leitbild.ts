import { BlobServiceClient } from "@azure/storage-blob"

const LEITBILD_CONTAINER = "order-leitbilder"

function decodeBase64Png(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/)
  if (!match) return null
  return Buffer.from(match[1], "base64")
}

export async function uploadOrderLeitbild(
  orderId: string,
  itemId: string,
  leitbildDataUrl: string
): Promise<string | null> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!connectionString) {
    console.warn(
      "Leitbild-Speicher: AZURE_STORAGE_CONNECTION_STRING fehlt — Upload übersprungen."
    )
    return null
  }

  const buffer = decodeBase64Png(leitbildDataUrl)
  if (!buffer || buffer.length === 0) {
    console.warn("Leitbild-Speicher: Ungültiges PNG-Format.")
    return null
  }

  try {
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient =
      blobServiceClient.getContainerClient(LEITBILD_CONTAINER)
    await containerClient.createIfNotExists({ access: "blob" })

    const safeItemId = itemId.replace(/[^a-zA-Z0-9-_]/g, "_")
    const blobName = `${orderId}/${safeItemId}-leitbild.png`
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: "image/png" },
    })

    return blockBlobClient.url
  } catch (error) {
    console.warn("Leitbild-Speicher: Azure-Upload fehlgeschlagen.", error)
    return null
  }
}
