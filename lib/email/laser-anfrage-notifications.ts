import { getSettings } from "@/lib/admin/db"
import { resolveAdminNotifyEmail } from "@/lib/email/resolve-admin-notify-email"
import { resolveEmailBranding } from "@/lib/email/order-email-context"
import {
  renderDripForgeEmailHtml,
  renderEmailCtaButton,
  textToHtmlParagraphs,
} from "@/lib/email/dripforge-email-layout"
import { resolveSmtpFrom, sendSmtpMail } from "@/lib/email/smtp"

export type LaserAnfragePayload = {
  customerName: string
  customerEmail: string
  customerPhone?: string
  message?: string
  material: string
  categoryLabel?: string
  categoryFromPriceChf?: number
  productLengthMm?: number
  productWidthMm?: number
  productHeightMm?: number
  quantity: number
  engravingText?: string
  mockupDataUrl?: string | null
  productionLayerDataUrl?: string | null
  productBackgroundDataUrl?: string | null
  uploadedImageDataUrls?: string[]
}

function dataUrlToAttachment(
  dataUrl: string | null | undefined,
  filename: string,
  cid: string
): {
  filename: string
  content: Buffer
  contentType: string
  cid: string
} | null {
  if (!dataUrl?.startsWith("data:")) return null
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl)
  if (!match) return null
  const contentType = match[1] || "image/png"
  try {
    return {
      filename,
      content: Buffer.from(match[2]!, "base64"),
      contentType,
      cid,
    }
  } catch {
    return null
  }
}

export async function notifyAdminLaserAnfrage(
  payload: LaserAnfragePayload
): Promise<boolean> {
  try {
    const settings = await getSettings()
    const to = resolveAdminNotifyEmail(settings) || "shop@dripforge.ch"
    const branding = await resolveEmailBranding(settings).catch(() => ({
      companyName: "DripForge",
      contactEmail: "shop@dripforge.ch",
      footerLines: {
        line1: "DripForge",
        line2: "shop@dripforge.ch",
        line3: "",
      },
      logoUrl: null as string | null,
    }))

    const dims =
      payload.productLengthMm &&
      payload.productWidthMm &&
      payload.productHeightMm
        ? `${payload.productLengthMm} × ${payload.productWidthMm} × ${payload.productHeightMm} mm`
        : "—"

    const plainBody = [
      "Neue unverbindliche Laser-Anfrage",
      "",
      `Name: ${payload.customerName}`,
      `E-Mail: ${payload.customerEmail}`,
      payload.customerPhone ? `Telefon: ${payload.customerPhone}` : null,
      payload.message ? `Nachricht: ${payload.message}` : null,
      "",
      `Material: ${payload.material}`,
      payload.categoryLabel
        ? `Preiskategorie: ${payload.categoryLabel}${
            payload.categoryFromPriceChf != null
              ? ` (ab CHF ${payload.categoryFromPriceChf.toFixed(2)})`
              : ""
          }`
        : null,
      `Produktmasse: ${dims}`,
      `Menge: ${payload.quantity}`,
      payload.engravingText ? `Gravurtext: ${payload.engravingText}` : null,
      "",
      "Anhänge: Mockup, Kundenbilder und freigestellte PNG (falls übermittelt).",
    ]
      .filter((line) => line !== null)
      .join("\n")

    const attachments = [
      dataUrlToAttachment(payload.mockupDataUrl, "laser-mockup.png", "mockup"),
      dataUrlToAttachment(
        payload.productionLayerDataUrl,
        "laser-production-layer.png",
        "production"
      ),
      dataUrlToAttachment(
        payload.productBackgroundDataUrl,
        "laser-produktbild.png",
        "product"
      ),
      ...(payload.uploadedImageDataUrls ?? []).map((url, index) =>
        dataUrlToAttachment(
          url,
          `laser-original-${index + 1}.png`,
          `original${index + 1}`
        )
      ),
    ].filter(Boolean) as Array<{
      filename: string
      content: Buffer
      contentType: string
      cid: string
    }>

    const previewHtml = attachments
      .map(
        (att) =>
          `<p><strong>${att.filename}</strong><br/><img src="cid:${att.cid}" alt="${att.filename}" style="max-width:100%;height:auto;border-radius:8px;" /></p>`
      )
      .join("")

    const html = renderDripForgeEmailHtml({
      title: "Laser-Anfrage",
      bodyHtml:
        textToHtmlParagraphs(plainBody) +
        previewHtml +
        renderEmailCtaButton(
          `mailto:${encodeURIComponent(payload.customerEmail)}`,
          "Kunde antworten"
        ),
      footerLines: branding.footerLines,
      logoUrl: branding.logoUrl ?? undefined,
    })

    return sendSmtpMail({
      from: resolveSmtpFrom("DripForge", "shop@dripforge.ch"),
      to,
      subject: `Laser-Anfrage von ${payload.customerName}`,
      text: plainBody,
      html,
      attachments: attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
        cid: att.cid,
      })),
    })
  } catch (error) {
    console.error("Laser-Anfrage Admin-Mail fehlgeschlagen.", error)
    return false
  }
}
