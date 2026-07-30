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

  if (item.leitbildUrl || item.leitbild) {
    links.push({
      id: `${item.id}-leitbild`,
      label: "Leitbild (Vorschau)",
      filename: `leitbild-${item.id}.png`,
      href: `${base}?type=leitbild`,
    })
  }

  if (details?.uploadedImage) {
    links.push({
      id: `${item.id}-logo`,
      label: "Logo / Grafik",
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
      label: details?.fileName?.trim()
        ? `3D-Datei (${details.fileName.trim()})`
        : "3D-Datei (STL)",
      filename: details?.fileName?.trim() || `modell-${item.id}.stl`,
      href: `${base}?type=modell`,
    })
  }

  return links
}
