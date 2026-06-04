import type { StoredOrderItem } from "@/lib/admin/types"
import { sanitizeFilename } from "@/lib/admin/sanitize-filename"

export type ItemDownloadLink = {
  id: string
  label: string
  filename: string
  /** Direkt-URL, Data-URL oder Admin-Proxy-Pfad */
  href: string
  kind: "blob" | "data" | "proxy"
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function isDataUrl(value: string): boolean {
  return value.startsWith("data:")
}

export function getItemDownloadLinks(
  orderId: string,
  item: StoredOrderItem
): ItemDownloadLink[] {
  const links: ItemDownloadLink[] = []
  const details = item.customDetails

  const leitbildSrc = item.leitbildUrl ?? item.leitbild
  if (leitbildSrc) {
    if (isHttpUrl(leitbildSrc)) {
      links.push({
        id: `${item.id}-leitbild`,
        label: "Leitbild (Azure)",
        filename: sanitizeFilename(`${orderId}-${item.id}-leitbild.png`),
        href: `/api/admin/download-blob?url=${encodeURIComponent(leitbildSrc)}`,
        kind: "proxy",
      })
    } else if (isDataUrl(leitbildSrc)) {
      links.push({
        id: `${item.id}-leitbild`,
        label: "Leitbild",
        filename: sanitizeFilename(`${orderId}-${item.id}-leitbild.png`),
        href: leitbildSrc,
        kind: "data",
      })
    }
  }

  if (details?.uploadedImage) {
    const img = details.uploadedImage
    if (isHttpUrl(img)) {
      links.push({
        id: `${item.id}-logo`,
        label: "Logo / Grafik",
        filename: sanitizeFilename(`${orderId}-${item.id}-logo.png`),
        href: `/api/admin/download-blob?url=${encodeURIComponent(img)}`,
        kind: "proxy",
      })
    } else if (isDataUrl(img)) {
      links.push({
        id: `${item.id}-logo`,
        label: "Logo / Grafik",
        filename: sanitizeFilename(`${orderId}-${item.id}-logo.png`),
        href: img,
        kind: "data",
      })
    }
  }

  if (details?.colorReferenceImage) {
    const img = details.colorReferenceImage
    const name =
      details.colorReferenceImageName ?? `${item.id}-farb-skizze.png`
    if (isHttpUrl(img)) {
      links.push({
        id: `${item.id}-skizze`,
        label: "Farb-Skizze",
        filename: sanitizeFilename(name),
        href: `/api/admin/download-blob?url=${encodeURIComponent(img)}`,
        kind: "proxy",
      })
    } else if (isDataUrl(img)) {
      links.push({
        id: `${item.id}-skizze`,
        label: "Farb-Skizze",
        filename: sanitizeFilename(name),
        href: img,
        kind: "data",
      })
    }
  }

  return links
}
