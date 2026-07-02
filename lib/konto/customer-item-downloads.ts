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
  const details = item.customDetails
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

  return links
}
