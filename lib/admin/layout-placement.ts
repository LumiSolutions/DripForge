import type { LayoutPosition } from "@/lib/dripforge/types"
import type { StoredOrderItem } from "@/lib/admin/types"
import {
  guessStlSiblingUrl,
  isPrintProductionFile,
  isViewerOnlyFile,
} from "@/lib/dripforge/product-print-file"

function axisLabel(
  value: number,
  low: string,
  mid: string,
  high: string
): string {
  if (value < 35) return low
  if (value > 65) return high
  return mid
}

/** Menschenlesbare Platzierung aus %-Koordinaten (Designer: left/top %). */
export function describeLayoutPosition(pos: LayoutPosition): string {
  const x = Number(pos.x)
  const y = Number(pos.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "Unbekannt"

  const horizontal = axisLabel(x, "links", "mittig", "rechts")
  const vertical = axisLabel(y, "oben", "mittig", "unten")

  if (horizontal === "mittig" && vertical === "mittig") return "Zentriert"
  if (horizontal === "mittig") return vertical === "oben" ? "Oben zentriert" : "Unten zentriert"
  if (vertical === "mittig") return horizontal === "links" ? "Links zentriert" : "Rechts zentriert"
  return `${vertical.charAt(0).toUpperCase()}${vertical.slice(1)} ${horizontal}`
}

export function formatLayoutPositionDetails(pos: LayoutPosition): string {
  const parts = [
    describeLayoutPosition(pos),
    `${Math.round(pos.x)}% / ${Math.round(pos.y)}%`,
  ]
  if (pos.scale != null && Number.isFinite(pos.scale)) {
    parts.push(`${pos.scale.toFixed(1)}×`)
  }
  if (pos.rotation != null && Number.isFinite(pos.rotation) && pos.rotation !== 0) {
    parts.push(`${Math.round(pos.rotation)}°`)
  }
  return parts.join(" · ")
}

export function getLaserPlacementLines(item: StoredOrderItem): {
  label: string
  value: string
}[] {
  const coords = item.customDetails?.layoutCoordinates
  if (!coords) return []

  const lines: { label: string; value: string }[] = []
  const layers = Array.isArray(coords.layers) ? coords.layers : []

  if (layers.length > 0) {
    let imageIndex = 0
    let textIndex = 0
    for (const layer of layers) {
      const pos = {
        x: Number(layer.x) || 50,
        y: Number(layer.y) || 50,
        scale: layer.scale,
        rotation: layer.rotation,
      }
      if (layer.kind === "image") {
        imageIndex += 1
        lines.push({
          label: `Bild ${imageIndex}-Position`,
          value: formatLayoutPositionDetails(pos),
        })
      } else if (layer.kind === "text") {
        textIndex += 1
        const snippet = (layer.text ?? "").trim().slice(0, 40)
        lines.push({
          label: `Text ${textIndex}-Position`,
          value: `${formatLayoutPositionDetails(pos)}${snippet ? ` · „${snippet}${snippet.length >= 40 ? "…" : ""}“` : ""}`,
        })
      }
    }
    return lines
  }

  const hasText = Boolean(
    (item.customDetails?.userText ?? item.customDetails?.engravingText)?.trim()
  )
  const hasImage = Boolean(
    item.customDetails?.uploadedImage || item.customDetails?.hasImage
  )

  if (hasText && coords.textPosition) {
    lines.push({
      label: "Text-Position",
      value: formatLayoutPositionDetails(coords.textPosition),
    })
  }
  if (hasImage && coords.imagePosition) {
    lines.push({
      label: "Logo-Position",
      value: formatLayoutPositionDetails(coords.imagePosition),
    })
  }
  return lines
}

export function getItemLogoPreviewSrc(item: StoredOrderItem): string | null {
  const img = item.customDetails?.uploadedImage
  if (typeof img === "string" && img.trim()) return img
  return null
}

/** Primäre Vorschau: Laser-Mockup (Composite) oder Leitbild. */
export function getItemCompositePreviewSrc(item: StoredOrderItem): string | null {
  const src =
    item.previewMockupUrl ??
    item.previewMockup ??
    item.leitbildUrl ??
    item.leitbild ??
    null
  return typeof src === "string" && src.trim() ? src : null
}

export function getItemModelFile(
  item: StoredOrderItem
): { fileName: string; fileUrl: string | null } | null {
  if (item.type !== "3d") return null
  const details = item.customDetails as
    | (NonNullable<StoredOrderItem["customDetails"]> & {
        fileUrl?: string | null
        modelUrl?: string | null
      })
    | undefined
  const fileName = details?.fileName?.trim()
  const fileUrl =
    (typeof details?.fileUrl === "string" && details.fileUrl) ||
    (typeof details?.modelUrl === "string" && details.modelUrl) ||
    null

  // Viewer-only (GLB) ohne Druckdatei: keinen STL-Download vortäuschen
  if (fileUrl) {
    if (isPrintProductionFile(fileUrl)) {
      return {
        fileName: fileName || "modell.stl",
        fileUrl,
      }
    }
    if (isViewerOnlyFile(fileUrl)) {
      const sibling = guessStlSiblingUrl(fileUrl)
      if (sibling) {
        return {
          fileName:
            fileName && /\.(stl|3mf|gcode)$/i.test(fileName)
              ? fileName
              : "modell.stl",
          fileUrl: sibling,
        }
      }
      return null
    }
  }

  if (!fileName && !fileUrl) return null
  if (fileName && !/\.(stl|3mf|gcode)$/i.test(fileName) && /\.(glb|gltf|obj)$/i.test(fileName)) {
    return null
  }
  return {
    fileName: fileName || "modell.stl",
    fileUrl,
  }
}

export function orderMatchesJobType(
  items: { type: "3d" | "laser" }[],
  jobType: "all" | "3d" | "laser"
): boolean {
  if (jobType === "all") return true
  return items.some((item) => item.type === jobType)
}
