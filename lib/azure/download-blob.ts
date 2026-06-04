import { BlobServiceClient } from "@azure/storage-blob"

const ALLOWED_CONTAINERS = new Set(["order-leitbilder"])

export function parseAllowedBlobUrl(
  rawUrl: string
): { container: string; blobName: string } | null {
  try {
    const url = new URL(rawUrl)
    const parts = url.pathname.split("/").filter(Boolean)
    if (parts.length < 2) return null
    const container = parts[0]
    if (!ALLOWED_CONTAINERS.has(container)) return null
    const blobName = parts.slice(1).join("/")
    return { container, blobName }
  } catch {
    return null
  }
}

export async function downloadBlobAsBuffer(
  container: string,
  blobName: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
  if (!connectionString) return null

  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString)
  const blobClient = blobServiceClient
    .getContainerClient(container)
    .getBlockBlobClient(blobName)

  const exists = await blobClient.exists()
  if (!exists) return null

  const download = await blobClient.download(0)
  const chunks: Buffer[] = []
  if (!download.readableStreamBody) return null

  for await (const chunk of download.readableStreamBody) {
    chunks.push(Buffer.from(chunk))
  }

  const properties = await blobClient.getProperties()
  return {
    buffer: Buffer.concat(chunks),
    contentType: properties.contentType ?? "application/octet-stream",
  }
}
