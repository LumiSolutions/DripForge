import type { StoredOrderItem } from "@/lib/admin/types"

/** Schlanke Design-Config aus einer Bestellposition für Speichern / Nachbestellen. */
export function buildDesignConfigFromOrderItem(
  item: StoredOrderItem
): Record<string, unknown> | null {
  const details = item.customDetails
  if (!details) {
    if (item.previewMockupUrl || item.leitbildUrl || item.previewMockup) {
      return {
        previewMockupUrl:
          item.previewMockupUrl ?? item.leitbildUrl ?? item.previewMockup ?? null,
      }
    }
    return null
  }

  const hasContent = Boolean(
    details.engravingText?.trim() ||
      details.userText?.trim() ||
      details.uploadedImage ||
      details.hasImage ||
      details.hasText ||
      details.fileName ||
      details.layoutCoordinates?.layers?.length ||
      details.filament ||
      details.material
  )
  if (!hasContent) return null

  return {
    materialId: details.material ?? details.materialVariant ?? null,
    material: details.material ?? null,
    materialVariant: details.materialVariant ?? null,
    variant: details.variant ?? details.size ?? null,
    size: details.size ?? null,
    filament: details.filament ?? null,
    color: details.color ?? null,
    dimensions: details.dimensions ?? null,
    scale: details.scale ?? null,
    engravingText: details.engravingText ?? details.userText ?? null,
    userText: details.userText ?? details.engravingText ?? null,
    selectedFont: details.userFont ?? null,
    userFont: details.userFont ?? null,
    uploadedImage: details.uploadedImage ?? null,
    uploadedImages: details.uploadedImages ?? undefined,
    hasImage: details.hasImage,
    hasText: details.hasText,
    layers: details.layoutCoordinates?.layers ?? undefined,
    textLayout: details.layoutCoordinates?.textPosition ?? undefined,
    imageLayout: details.layoutCoordinates?.imagePosition ?? undefined,
    layoutCoordinates: details.layoutCoordinates ?? undefined,
    productBackgroundUrl: details.productBackgroundUrl ?? null,
    fileName: details.fileName ?? null,
    fileUrl: details.fileUrl ?? null,
    modelUrl: details.modelUrl ?? null,
    isCustomerInbound: details.isCustomerInbound,
    previewMockupUrl:
      item.previewMockupUrl ?? item.leitbildUrl ?? item.previewMockup ?? null,
  }
}

export function orderItemHasSaveableDesign(item: StoredOrderItem): boolean {
  return buildDesignConfigFromOrderItem(item) != null
}
