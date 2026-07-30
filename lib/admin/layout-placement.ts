import type { LayoutPosition } from "@/lib/dripforge/types"
import type { StoredOrderItem } from "@/lib/admin/types"

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
  if (!fileName && !fileUrl) return null
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
