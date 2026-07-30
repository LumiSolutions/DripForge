/** Re-export — Upload-Logik liegt in upload-order-asset.ts */
export {
  decodeDataUrl,
  uploadOrderAsset,
  uploadOrderLeitbild,
} from "@/lib/azure/upload-order-asset"

import { uploadOrderAsset } from "@/lib/azure/upload-order-asset"

/** Transparente Produktionsdatei (nur Gravur-Inhalte, ohne Produkthintergrund). */
export async function uploadOrderProductionLayer(
  orderId: string,
  itemId: string,
  productionDataUrl: string
): Promise<string | null> {
  return uploadOrderAsset(orderId, itemId, "production_layer", productionDataUrl)
}
