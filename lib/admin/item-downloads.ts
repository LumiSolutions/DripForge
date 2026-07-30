import type { StoredOrder, StoredOrderItem } from "@/lib/admin/types"
import { sanitizeFilename } from "@/lib/admin/sanitize-filename"
import { resolveSiteOrigin } from "@/lib/site/site-origin"
import { filenameFromAssetUrl } from "@/lib/dripforge/product-print-file"

export type ItemDownloadLink = {
  id: string
  label: string
  filename: string
  /** Direkt-URL, Data-URL oder Admin-Proxy-Pfad */
  href: string
  kind: "blob" | "data" | "proxy"
  role?: "stl" | "leitbild" | "logo" | "mockup" | "skizze"
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith("/")
}

function isDataUrl(value: string): boolean {
  return value.startsWith("data:")
}

function proxyHref(url: string): string {
  return `/api/admin/download-blob?url=${encodeURIComponent(url)}`
}

export function getItemMockupSrc(item: StoredOrderItem): string | null {
  const src =
    item.previewMockupUrl ??
    item.previewMockup ??
    item.leitbildUrl ??
    item.leitbild ??
    null
  return typeof src === "string" && src.trim() ? src : null
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

  const mockupSrc = getItemMockupSrc(item)
  const leitbildOnly =
    item.leitbildUrl ?? item.leitbild ?? null

  if (item.type === "laser" && mockupSrc) {
    if (isHttpUrl(mockupSrc)) {
      links.push({
        id: `${item.id}-mockup`,
        label: "Vorschau-Mockup",
        filename: sanitizeFilename(`${orderId}-${item.id}-mockup.png`),
        href: proxyHref(mockupSrc),
        kind: "proxy",
        role: "mockup",
      })
    } else if (isDataUrl(mockupSrc)) {
      links.push({
        id: `${item.id}-mockup`,
        label: "Vorschau-Mockup",
        filename: sanitizeFilename(`${orderId}-${item.id}-mockup.png`),
        href: mockupSrc,
        kind: "data",
        role: "mockup",
      })
    }
  } else if (item.type === "3d" && leitbildOnly) {
    if (isHttpUrl(leitbildOnly)) {
      links.push({
        id: `${item.id}-leitbild`,
        label: "Leitbild anzeigen",
        filename: sanitizeFilename(`${orderId}-${item.id}-leitbild.png`),
        href: proxyHref(leitbildOnly),
        kind: "proxy",
        role: "leitbild",
      })
    } else if (isDataUrl(leitbildOnly)) {
      links.push({
        id: `${item.id}-leitbild`,
        label: "Leitbild anzeigen",
        filename: sanitizeFilename(`${orderId}-${item.id}-leitbild.png`),
        href: leitbildOnly,
        kind: "data",
        role: "leitbild",
      })
    }
  } else if (mockupSrc && item.type !== "3d") {
    // Fallback for mixed/legacy
    if (isHttpUrl(mockupSrc)) {
      links.push({
        id: `${item.id}-leitbild`,
        label: "Leitbild anzeigen",
        filename: sanitizeFilename(`${orderId}-${item.id}-leitbild.png`),
        href: proxyHref(mockupSrc),
        kind: "proxy",
        role: "leitbild",
      })
    }
  }

  if (details?.uploadedImage) {
    const img = details.uploadedImage
    if (isHttpUrl(img)) {
      links.push({
        id: `${item.id}-logo`,
        label: "Original Logo/Grafik",
        filename: sanitizeFilename(`${orderId}-${item.id}-logo.png`),
        href: proxyHref(img),
        kind: "proxy",
        role: "logo",
      })
    } else if (isDataUrl(img)) {
      links.push({
        id: `${item.id}-logo`,
        label: "Original Logo/Grafik",
        filename: sanitizeFilename(`${orderId}-${item.id}-logo.png`),
        href: img,
        kind: "data",
        role: "logo",
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
        href: proxyHref(img),
        kind: "proxy",
        role: "skizze",
      })
    } else if (isDataUrl(img)) {
      links.push({
        id: `${item.id}-skizze`,
        label: "Farb-Skizze",
        filename: sanitizeFilename(name),
        href: img,
        kind: "data",
        role: "skizze",
      })
    }
  }

  const modelSrc = details?.fileUrl || details?.modelUrl
  if (modelSrc && typeof modelSrc === "string" && isHttpUrl(modelSrc)) {
    const fileName =
      details?.fileName ||
      filenameFromAssetUrl(modelSrc, `${orderId}-${item.id}-modell.stl`)
    links.push({
      id: `${item.id}-modell`,
      label: "STL-Datei herunterladen",
      filename: sanitizeFilename(fileName),
      href: proxyHref(modelSrc),
      kind: "proxy",
      role: "stl",
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
    if (src && /^https?:\/\//i.test(src)) {
      refs.push({ itemName: item.name, label, href: src })
    }
  }

  push("Vorschau-Mockup", item.previewMockupUrl ?? undefined)
  push("Leitbild", item.leitbildUrl ?? undefined)
  push("Original Logo/Grafik", details?.uploadedImage)
  push("Farb-Skizze", details?.colorReferenceImage)
  const modelSrc = details?.fileUrl || details?.modelUrl
  if (modelSrc && /^https?:\/\//i.test(modelSrc)) {
    refs.push({
      itemName: item.name,
      label: `STL-Datei${details?.fileName ? ` (${details.fileName})` : ""}`,
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
