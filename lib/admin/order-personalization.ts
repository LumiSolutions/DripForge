import type { StoredOrderItem } from "@/lib/admin/types"
import { getLaserPlacementLines } from "@/lib/admin/layout-placement"

export type PersonalizationLine = {
  label: string
  value: string
}

export function getItemPersonalizationLines(
  item: StoredOrderItem
): PersonalizationLine[] {
  const d = item.customDetails
  if (!d) return []

  const lines: PersonalizationLine[] = []

  if (item.type === "3d") {
    if (d.fileName) lines.push({ label: "3D-Datei", value: d.fileName })
    if (d.filament) lines.push({ label: "Filament", value: d.filament })
    if (d.color) lines.push({ label: "Farbe", value: d.color })
    if (d.colorWishes) lines.push({ label: "Farbwünsche", value: d.colorWishes })
    if (d.dimensions) lines.push({ label: "Masse", value: d.dimensions })
    if (d.scale) lines.push({ label: "Skalierung", value: d.scale })
  }

  if (item.type === "laser" || d.material || d.userText) {
    if (d.isCustomerInbound || d.customerShipping) {
      lines.push({ label: "Einsendung", value: "Eigenes Produkt des Kunden" })
    }
    if (d.material) lines.push({ label: "Material", value: d.material })
    if (d.variant || d.materialVariant) {
      lines.push({
        label: "Variante",
        value: d.variant ?? d.materialVariant ?? "",
      })
    }
    const text = d.userText ?? d.engravingText
    if (text?.trim()) lines.push({ label: "Gravurtext", value: text.trim() })
    if (d.userFont) lines.push({ label: "Schrift", value: d.userFont })
    if (d.uploadedImage || d.hasImage) {
      lines.push({
        label: "Logo/Grafik",
        value: d.uploadedImage
          ? Array.isArray(d.uploadedImages) && d.uploadedImages.length > 1
            ? `${d.uploadedImages.length} Dateien`
            : "hochgeladen"
          : "ja",
      })
    }
    const layerCount = d.layoutCoordinates?.layers?.length ?? 0
    if (layerCount > 0) {
      const imgCount =
        d.layoutCoordinates?.layers?.filter((l) => l.kind === "image").length ?? 0
      const textCount =
        d.layoutCoordinates?.layers?.filter((l) => l.kind === "text").length ?? 0
      lines.push({
        label: "Elemente",
        value: `${layerCount} Layer${imgCount || textCount ? ` (${imgCount} Bild${imgCount === 1 ? "" : "er"}, ${textCount} Text${textCount === 1 ? "" : "e"})` : ""}`,
      })
    }
    for (const placement of getLaserPlacementLines(item)) {
      lines.push(placement)
    }
  }

  return lines.filter((l) => l.value.length > 0)
}
