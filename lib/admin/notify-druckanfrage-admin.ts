import type { Druckanfrage } from "@/lib/admin/druckanfrage-types"
import { sendWhatsAppTextToAdmin } from "@/lib/chat/whatsapp-gateway"

function formatDruckanfrageMessage(anfrage: Druckanfrage): string {
  const contactLabel =
    anfrage.contactMethod === "whatsapp"
      ? `WhatsApp: ${anfrage.customerPhone ?? "—"}`
      : `E-Mail: ${anfrage.customerEmail}`

  const colors = anfrage.filamentColors.join(", ") || "—"
  const dims = `${anfrage.dimensionsMm.x.toFixed(1)} x ${anfrage.dimensionsMm.y.toFixed(1)} x ${anfrage.dimensionsMm.z.toFixed(1)} mm`

  return [
    "Neue 3D-Druckanfrage",
    `ID: ${anfrage.id}`,
    `Datei: ${anfrage.fileName}`,
    `Kontakt: ${contactLabel}`,
    anfrage.customerEmail ? `E-Mail: ${anfrage.customerEmail}` : null,
    anfrage.customerPhone ? `Telefon: ${anfrage.customerPhone}` : null,
    `Material: ${anfrage.filamentMaterial}`,
    `Farben: ${colors}`,
    `Masse: ${dims} · Skalierung ${anfrage.scalePercent}%`,
    `Menge: ${anfrage.quantity}`,
    `Richtpreis: ab CHF ${anfrage.estimatedTotalPrice.toFixed(2)}`,
    anfrage.fileUrl ? `Modell: ${anfrage.fileUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

export async function notifyAdminDruckanfrage(anfrage: Druckanfrage): Promise<void> {
  const visitorLabel =
    anfrage.contactMethod === "whatsapp"
      ? anfrage.customerPhone ?? anfrage.customerEmail
      : anfrage.customerEmail

  await sendWhatsAppTextToAdmin(anfrage.id, visitorLabel, formatDruckanfrageMessage(anfrage))
}
