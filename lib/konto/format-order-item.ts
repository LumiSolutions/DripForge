import type { StoredOrderItem } from "@/lib/admin/types"
import {
  getCustomerItemDownloadLinks,
  type CustomerItemDownload,
} from "@/lib/konto/customer-item-downloads"

export type CustomerOrderItemView = {
  id: string
  name: string
  quantity: number
  unitPriceChf: number
  lineTotalChf: number
  type: "3d" | "laser"
  imageUrl: string | null
  fileName: string | null
  engravingText: string | null
  options: string[]
  downloads: CustomerItemDownload[]
}

function pushOption(options: string[], label: string, value?: string | null) {
  const trimmed = value?.trim()
  if (trimmed) options.push(`${label}: ${trimmed}`)
}

export function mapOrderItemToCustomerView(
  item: StoredOrderItem,
  orderId: string
): CustomerOrderItemView {
  const details = item.customDetails
  const options: string[] = []

  pushOption(options, "Filament", details?.filament)
  pushOption(options, "Farbe", details?.color)
  pushOption(options, "Material", details?.material ?? details?.materialVariant)
  pushOption(options, "Variante", details?.variant ?? details?.materialVariant ?? details?.size)
  pushOption(options, "Masse", details?.dimensions)
  pushOption(options, "Skalierung", details?.scale)
  pushOption(options, "Gravur", details?.engravingText ?? details?.userText)
  pushOption(options, "Schrift", details?.userFont)
  pushOption(options, "3D-Datei", details?.fileName)

  if (details?.colorWishes?.trim()) {
    pushOption(options, "Farbwünsche", details.colorWishes)
  }

  const imageUrl =
    item.leitbildUrl ??
    details?.uploadedImage ??
    details?.colorReferenceImage ??
    null

  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPriceChf: item.price,
    lineTotalChf: Math.round(item.price * item.quantity * 100) / 100,
    type: item.type,
    imageUrl,
    fileName: details?.fileName?.trim() || null,
    engravingText: (details?.engravingText ?? details?.userText)?.trim() || null,
    options,
    downloads: getCustomerItemDownloadLinks(orderId, item),
  }
}
