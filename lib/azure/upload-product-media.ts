import { BlobServiceClient } from "@azure/storage-blob"

const PRODUCT_MEDIA_CONTAINER = "product-media"

export async function uploadProductMediaBlob(
  productId: string,
  category: string,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string | null> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!connectionString) {
    console.warn(
      "Produkt-Medien: AZURE_STORAGE_CONNECTION_STRING fehlt — Upload uebersprungen."
    )
    return null
  }

  try {
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient =
      blobServiceClient.getContainerClient(PRODUCT_MEDIA_CONTAINER)
    await containerClient.createIfNotExists({ access: "blob" })

    const safeProductId = productId.replace(/[^a-zA-Z0-9-_]/g, "_")
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
    const blobName = `${safeProductId}/${category}/${Date.now()}-${safeName}`
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
    })

    return blockBlobClient.url
  } catch (error) {
    console.warn("Produkt-Medien: Azure-Upload fehlgeschlagen.", error)
    return null
  }
}

/** Fallback fuer lokale Entwicklung ohne Blob Storage (nur Bilder). */
export function bufferToDataUrl(buffer: Buffer, contentType: string): string {
  const base64 = buffer.toString("base64")
  return `data:${contentType};base64,${base64}`
}

export function isImageContentType(contentType: string): boolean {
  return contentType.startsWith("image/")
}

export const MAX_IMAGE_DATA_URL_BYTES = 2 * 1024 * 1024
