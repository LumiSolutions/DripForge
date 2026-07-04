import { uploadProductMediaBlob } from "@/lib/azure/upload-product-media"

export async function uploadDruckanfrageFile(
  anfrageId: string,
  category: "model" | "leitbild" | "color-reference",
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string | null> {
  return uploadProductMediaBlob(anfrageId, `druckanfrage-${category}`, buffer, filename, contentType)
}
