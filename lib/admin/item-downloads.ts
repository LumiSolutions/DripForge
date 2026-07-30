import type { StoredOrder, StoredOrderItem } from "@/lib/admin/types"
import { sanitizeFilename } from "@/lib/admin/sanitize-filename"
import { resolveSiteOrigin } from "@/lib/site/site-origin"
import {
  forceStlDownloadFilename,
  isPrintProductionFile,
  isViewerOnlyFile,
  guessStlSiblingUrl,
  filenameFromAssetUrl,
} from "@/lib/dripforge/product-print-file"

export type ItemDownloadLink = {
  id: string
  label: string
  filename: string
  /** Direkt-URL, Data-URL oder Admin-Proxy-Pfad */
  href: string
  kind: "blob" | "data" | "proxy"
  role?: "stl" | "leitbild" | "logo" | "mockup" | "skizze" | "text"
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith("/")
}

function isDataUrl(value: string): boolean {
  return value.startsWith("data:")
}

function proxyHref(url: string, filename?: string): string {
  const params = new URLSearchParams({ url })
  if (filename) params.set("filename", filename)
  return `/api/admin/download-blob?${params.toString()}`
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

function resolvePrintModelSrc(
  details:
    | (NonNullable<StoredOrderItem["customDetails"]> & {
        fileUrl?: string | null
        modelUrl?: string | null
      })
    | undefined
): { url: string; fileName: string } | null {
  if (!details) return null
  const candidates = [details.fileUrl, details.modelUrl]
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean)

  for (const url of candidates) {
    if (isPrintProductionFile(url) && isHttpUrl(url)) {
      return {
        url,
        fileName:
          details.fileName && isPrintProductionFile(details.fileName)
            ? details.fileName
            : filenameFromAssetUrl(url, details.fileName || "modell.stl"),
      }
    }
  }

  for (const url of candidates) {
    if (isViewerOnlyFile(url) && isHttpUrl(url)) {
      const sibling = guessStlSiblingUrl(url)
      if (sibling && isPrintProductionFile(sibling)) {
        return {
          url: sibling,
          fileName: forceStlDownloadFilename(
            "order",
            "item",
            details.fileName || filenameFromAssetUrl(sibling, "modell.stl")
          ),
        }
      }
    }
  }

  // Expliziter Dateiname mit Druck-Endung, URL kann trotzdem Viewer sein → Sibling
  if (details.fileName && isPrintProductionFile(details.fileName)) {
    for (const url of candidates) {
      if (!isHttpUrl(url)) continue
      if (isPrintProductionFile(url)) {
        return { url, fileName: details.fileName }
      }
      const sibling = guessStlSiblingUrl(url)
      if (sibling) return { url: sibling, fileName: details.fileName }
    }
  }

  return null
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
  const leitbildOnly = item.leitbildUrl ?? item.leitbild ?? null

  if (item.type === "laser" && mockupSrc) {
    const filename = sanitizeFilename(`${orderId}-${item.id}-mockup.png`)
    if (isHttpUrl(mockupSrc)) {
      links.push({
        id: `${item.id}-mockup`,
        label: "Vorschau-Mockup",
        filename,
        href: proxyHref(mockupSrc, filename),
        kind: "proxy",
        role: "mockup",
      })
    } else if (isDataUrl(mockupSrc)) {
      links.push({
        id: `${item.id}-mockup`,
        label: "Vorschau-Mockup",
        filename,
        href: mockupSrc,
        kind: "data",
        role: "mockup",
      })
    }
  } else if (item.type === "3d" && leitbildOnly) {
    const filename = sanitizeFilename(`${orderId}-${item.id}-leitbild.png`)
    if (isHttpUrl(leitbildOnly)) {
      links.push({
        id: `${item.id}-leitbild`,
        label: "Leitbild anzeigen",
        filename,
        href: proxyHref(leitbildOnly, filename),
        kind: "proxy",
        role: "leitbild",
      })
    } else if (isDataUrl(leitbildOnly)) {
      links.push({
        id: `${item.id}-leitbild`,
        label: "Leitbild anzeigen",
        filename,
        href: leitbildOnly,
        kind: "data",
        role: "leitbild",
      })
    }
  } else if (mockupSrc && item.type !== "3d") {
    const filename = sanitizeFilename(`${orderId}-${item.id}-leitbild.png`)
    if (isHttpUrl(mockupSrc)) {
      links.push({
        id: `${item.id}-leitbild`,
        label: "Leitbild anzeigen",
        filename,
        href: proxyHref(mockupSrc, filename),
        kind: "proxy",
        role: "leitbild",
      })
    }
  }

  // Alle Bild-Assets: uploadedImages + Layer-srcs (ohne Duplikate)
  const imageAssets: string[] = []
  const pushUnique = (src: string | null | undefined) => {
    if (!src || typeof src !== "string" || !src.trim()) return
    if (imageAssets.includes(src)) return
    imageAssets.push(src)
  }

  pushUnique(details?.uploadedImage)
  if (Array.isArray(details?.uploadedImages)) {
    for (const img of details.uploadedImages) pushUnique(img)
  }
  const layers = details?.layoutCoordinates?.layers ?? []
  for (const layer of layers) {
    if (layer.kind === "image") pushUnique(layer.src)
  }

  imageAssets.forEach((img, index) => {
    const n = index + 1
    const label = imageAssets.length === 1 ? "Bild 1" : `Bild ${n}`
    const filename = sanitizeFilename(`${orderId}-${item.id}-bild-${n}.png`)
    if (isHttpUrl(img)) {
      links.push({
        id: `${item.id}-logo-${n}`,
        label,
        filename,
        href: proxyHref(img, filename),
        kind: "proxy",
        role: "logo",
      })
    } else if (isDataUrl(img)) {
      links.push({
        id: `${item.id}-logo-${n}`,
        label,
        filename,
        href: img,
        kind: "data",
        role: "logo",
      })
    }
  })

  // Text-Layer als Infos (kein Binary) — Label für UI-Liste
  const textLayers = layers.filter(
    (l) => l.kind === "text" && typeof l.text === "string" && l.text.trim()
  )
  textLayers.forEach((layer, index) => {
    const n = index + 1
    const text = (layer.text ?? "").trim()
    links.push({
      id: `${item.id}-text-${n}`,
      label: `Text ${n}`,
      filename: sanitizeFilename(`${orderId}-${item.id}-text-${n}.txt`),
      href: `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`,
      kind: "data",
      role: "text",
    })
  })

  if (details?.colorReferenceImage) {
    const img = details.colorReferenceImage
    const name =
      details.colorReferenceImageName ?? `${item.id}-farb-skizze.png`
    const filename = sanitizeFilename(name)
    if (isHttpUrl(img)) {
      links.push({
        id: `${item.id}-skizze`,
        label: "Farb-Skizze",
        filename,
        href: proxyHref(img, filename),
        kind: "proxy",
        role: "skizze",
      })
    } else if (isDataUrl(img)) {
      links.push({
        id: `${item.id}-skizze`,
        label: "Farb-Skizze",
        filename,
        href: img,
        kind: "data",
        role: "skizze",
      })
    }
  }

  const printModel = resolvePrintModelSrc(details)
  if (printModel) {
    const filename = sanitizeFilename(
      forceStlDownloadFilename(orderId, item.id, printModel.fileName)
    )
    links.push({
      id: `${item.id}-modell`,
      label: "STL-Datei herunterladen",
      filename,
      href: proxyHref(printModel.url, filename),
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

  const printModel = resolvePrintModelSrc(details)
  if (printModel) {
    refs.push({
      itemName: item.name,
      label: `STL-Datei (${printModel.fileName})`,
      href: printModel.url,
    })
  } else if (details?.fileName?.trim() && isPrintProductionFile(details.fileName)) {
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
