import type { StoredOrder, StoredOrderItem } from "@/lib/admin/types"
import { sanitizeFilename } from "@/lib/admin/sanitize-filename"
import { resolveSiteOrigin } from "@/lib/site/site-origin"

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
  const details = item.customDetails as
    | (NonNullable<StoredOrderItem["customDetails"]> & {
        fileUrl?: string | null
        modelUrl?: string | null
      })
    | undefined

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

  const modelSrc = details?.fileUrl || details?.modelUrl
  if (modelSrc && typeof modelSrc === "string" && isHttpUrl(modelSrc)) {
    const fileName =
      details?.fileName ||
      sanitizeFilename(`${orderId}-${item.id}-modell.stl`)
    links.push({
      id: `${item.id}-modell`,
      label: `3D-Modell (${fileName})`,
      filename: sanitizeFilename(fileName),
      href: `/api/admin/download-blob?url=${encodeURIComponent(modelSrc)}`,
      kind: "proxy",
    })
  }

  return links
}

type EmailFileRef = {
  itemName: string
  label: string
  href: string
  fileNameNote?: string
}

function collectDirectHttpAssets(
  orderId: string,
  item: StoredOrderItem
): EmailFileRef[] {
  const refs: EmailFileRef[] = []
  const details = item.customDetails as
    | (NonNullable<StoredOrderItem["customDetails"]> & {
        fileUrl?: string | null
        modelUrl?: string | null
      })
    | undefined

  const push = (label: string, src: string | null | undefined) => {
    if (src && isHttpUrl(src)) {
      refs.push({ itemName: item.name, label, href: src })
    }
  }

  push("Leitbild", item.leitbildUrl ?? undefined)
  push("Logo / Grafik", details?.uploadedImage)
  push("Farb-Skizze", details?.colorReferenceImage)
  const modelSrc = details?.fileUrl || details?.modelUrl
  if (modelSrc && isHttpUrl(modelSrc)) {
    refs.push({
      itemName: item.name,
      label: `3D-Modell${details?.fileName ? ` (${details.fileName})` : ""}`,
      href: modelSrc,
    })
  } else if (details?.fileName?.trim()) {
    refs.push({
      itemName: item.name,
      label: "3D-Datei",
      href: "",
      fileNameNote: details.fileName.trim(),
    })
  }

  // Fallback: Admin-Proxy-Links wenn keine direkten URLs
  if (refs.length === 0) {
    const origin = resolveSiteOrigin()
    for (const link of getItemDownloadLinks(orderId, item)) {
      if (link.kind === "proxy") {
        refs.push({
          itemName: item.name,
          label: link.label,
          href: `${origin}${link.href}`,
        })
      }
    }
  }

  return refs
}

/** Absolute Download-URLs für Admin-Mails (ohne Data-URLs). */
export function collectOrderFileDownloadLines(order: StoredOrder): {
  plainLines: string[]
  htmlBlock: string
} {
  const plainLines: string[] = []
  const htmlItems: string[] = []

  for (const item of order.items) {
    const refs = collectDirectHttpAssets(order.orderId, item)
    for (const ref of refs) {
      if (ref.fileNameNote && !ref.href) {
        plainLines.push(
          `- ${ref.itemName}: Dateiname „${ref.fileNameNote}“ (kein Download-Link hinterlegt)`
        )
        htmlItems.push(
          `<li><strong>${escapeHtml(ref.itemName)}</strong>: Dateiname „${escapeHtml(ref.fileNameNote)}“ (kein Download-Link hinterlegt)</li>`
        )
        continue
      }
      plainLines.push(`- ${ref.itemName} — ${ref.label}: ${ref.href}`)
      htmlItems.push(
        `<li><strong>${escapeHtml(ref.itemName)}</strong> — ${escapeHtml(ref.label)}: <a href="${escapeHtml(ref.href)}">${escapeHtml(ref.href)}</a></li>`
      )
    }
  }

  if (plainLines.length === 0) {
    return { plainLines: [], htmlBlock: "" }
  }

  return {
    plainLines: ["Angehängte Kundendateien / Downloads:", ...plainLines],
    htmlBlock: `<p><strong>Angehängte Kundendateien / Downloads:</strong></p><ul>${htmlItems.join("")}</ul>`,
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
