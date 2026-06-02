import type { StoredOrderItem } from "@/lib/admin/types"
import { LASER_FONT_OPTIONS } from "@/lib/dripforge/laser-fonts"

function fontLabel(fontId?: string): string | null {
  if (!fontId) return null
  return LASER_FONT_OPTIONS.find((f) => f.id === fontId)?.label ?? fontId
}

/** Kurzbeschreibung fuer die Rechnungsposition (Masse, Varianten, Farben). */
export function formatInvoiceItemDetails(item: StoredOrderItem): string {
  const d = item.customDetails
  const parts: string[] = []

  if (item.type === "3d") {
    parts.push("3D-Druck")
    if (d?.fileName) parts.push(`Datei: ${d.fileName}`)
    if (d?.dimensions) parts.push(`Masse: ${d.dimensions}`)
    if (d?.scale) parts.push(`Skalierung: ${d.scale}`)
    if (d?.filament) parts.push(`Material: ${d.filament}`)
    if (d?.color) parts.push(`Farben: ${d.color}`)
    if (d?.colorWishes) parts.push(`Farbwuensche: ${d.colorWishes}`)
  } else {
    parts.push("Lasergravur")
    if (d?.material) parts.push(`Material: ${d.material}`)
    const variant = d?.variant ?? d?.materialVariant
    if (variant) parts.push(`Variante: ${variant}`)
    if (d?.size) parts.push(`Groesse: ${d.size}`)
    const text = d?.userText ?? d?.engravingText
    if (text?.trim()) parts.push(`Gravur: «${text.trim()}»`)
    const font = fontLabel(d?.userFont)
    if (font) parts.push(`Schrift: ${font}`)
  }

  return parts.length > 1 ? parts.slice(1).join(" · ") : parts[0] ?? "—"
}

export function getInvoiceLineTotal(item: StoredOrderItem): number {
  return item.price * item.quantity
}
