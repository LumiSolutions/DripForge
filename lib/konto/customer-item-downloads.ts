import type { StoredOrderItem } from "@/lib/admin/types"

export type CustomerItemDownload = {
  id: string
  label: string
  filename: string
  href: string
}

export function getCustomerItemDownloadLinks(
  orderId: string,
  item: StoredOrderItem
): CustomerItemDownload[] {
  const links: CustomerItemDownload[] = []
  const details = item.customDetails as
    | (NonNullable<StoredOrderItem["customDetails"]> & {
        fileUrl?: string | null
        modelUrl?: string | null
      })
    | undefined
  const base = `/api/customer/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(item.id)}/asset`

  if (item.type === "laser" && (item.previewMockupUrl || item.leitbildUrl || item.leitbild)) {
    links.push({
      id: `${item.id}-mockup`,
      label: "Vorschau-Mockup",
      filename: `mockup-${item.id}.png`,
      href: `${base}?type=mockup`,
    })
  } else if (item.leitbildUrl || item.leitbild) {
    links.push({
      id: `${item.id}-leitbild`,
      label: "Leitbild anzeigen",
      filename: `leitbild-${item.id}.png`,
      href: `${base}?type=leitbild`,
    })
  }

  if (details?.uploadedImage) {
    links.push({
      id: `${item.id}-logo`,
      label: "Original Logo/Grafik",
      filename: `grafik-${item.id}.png`,
      href: `${base}?type=logo`,
    })
  }

  if (details?.colorReferenceImage) {
    links.push({
      id: `${item.id}-skizze`,
      label: "Farb-Skizze",
      filename: details.colorReferenceImageName ?? `farb-skizze-${item.id}.png`,
      href: `${base}?type=skizze`,
    })
  }

  const modelSrc = details?.fileUrl || details?.modelUrl
  if (modelSrc) {
    links.push({
      id: `${item.id}-modell`,
      label: "STL-Datei herunterladen",
      filename: details?.fileName?.trim() || `modell-${item.id}.stl`,
      href: `${base}?type=modell`,
    })
  }

  return links
}
