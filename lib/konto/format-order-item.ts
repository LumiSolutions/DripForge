import type { StoredOrderItem } from "@/lib/admin/types"

export type CustomerOrderItemView = {
  id: string
  name: string
  quantity: number
  unitPriceChf: number
  lineTotalChf: number
  type: "3d" | "laser"
  imageUrl: string | null
  options: string[]
}

function pushOption(options: string[], label: string, value?: string | null) {
  const trimmed = value?.trim()
  if (trimmed) options.push(`${label}: ${trimmed}`)
}

export function mapOrderItemToCustomerView(item: StoredOrderItem): CustomerOrderItemView {
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
    options,
  }
}
