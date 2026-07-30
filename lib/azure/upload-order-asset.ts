import { BlobServiceClient } from "@azure/storage-blob"

const ORDER_ASSETS_CONTAINER = "order-leitbilder"

export type DecodedDataUrl = {
  buffer: Buffer
  contentType: string
  extension: string
}

export function decodeDataUrl(dataUrl: string): DecodedDataUrl | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/)
  if (!match) return null
  const contentType = match[1].toLowerCase()
  const buffer = Buffer.from(match[2], "base64")
  if (!buffer.length) return null

  let extension = "bin"
  if (contentType.includes("png")) extension = "png"
  else if (contentType.includes("jpeg") || contentType.includes("jpg")) extension = "jpg"
  else if (contentType.includes("webp")) extension = "webp"
  else if (contentType.includes("gif")) extension = "gif"
  else if (contentType.includes("svg")) extension = "svg"

  return { buffer, contentType, extension }
}

/**
 * Speichert ein Bestell-Asset (Leitbild / Mockup / Logo) in Azure Blob Storage.
 * Container bleibt `order-leitbilder` (Admin-/Customer-Proxy allowlist).
 */
export async function uploadOrderAsset(
  orderId: string,
  itemId: string,
  assetKind: "leitbild" | "mockup" | "logo" | "skizze",
  dataUrl: string
): Promise<string | null> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!connectionString) {
    console.warn(
      "Order-Asset: AZURE_STORAGE_CONNECTION_STRING fehlt — Upload übersprungen."
    )
    return null
  }

  const decoded = decodeDataUrl(dataUrl)
  if (!decoded) {
    console.warn(`Order-Asset: Ungültiges Data-URL-Format (${assetKind}).`)
    return null
  }

  try {
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString)
    const containerClient =
      blobServiceClient.getContainerClient(ORDER_ASSETS_CONTAINER)
    await containerClient.createIfNotExists({ access: "blob" })

    const safeItemId = itemId.replace(/[^a-zA-Z0-9-_]/g, "_")
    const blobName = `${orderId}/${safeItemId}-${assetKind}.${decoded.extension}`
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    await blockBlobClient.uploadData(decoded.buffer, {
      blobHTTPHeaders: { blobContentType: decoded.contentType },
    })

    return blockBlobClient.url
  } catch (error) {
    console.warn(`Order-Asset: Azure-Upload fehlgeschlagen (${assetKind}).`, error)
    return null
  }
}

/** @deprecated Nutze uploadOrderAsset(..., "leitbild", ...). */
export async function uploadOrderLeitbild(
  orderId: string,
  itemId: string,
  leitbildDataUrl: string
): Promise<string | null> {
  return uploadOrderAsset(orderId, itemId, "leitbild", leitbildDataUrl)
}
