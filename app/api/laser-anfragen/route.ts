import { NextResponse } from "next/server"
import { isValidContactEmail } from "@/lib/admin/druckanfrage-types"
import { notifyAdminLaserAnfrage } from "@/lib/email/laser-anfrage-notifications"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parsePositiveNumber(value: unknown): number | undefined {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.round(n * 10) / 10
}

function parseDataUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed.startsWith("data:") || trimmed.length > 8_000_000) return undefined
  return trimmed
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>

    const customerName = String(body.customerName ?? "").trim()
    const customerEmail = String(body.customerEmail ?? "").trim().toLowerCase()
    const customerPhone = String(body.customerPhone ?? "").trim() || undefined
    const message = String(body.message ?? "").trim() || undefined
    const material = String(body.material ?? "").trim()
    const categoryLabel = String(body.categoryLabel ?? "").trim() || undefined
    const categoryFromPriceChf = Number(body.categoryFromPriceChf)
    const quantity = Math.max(1, Math.round(Number(body.quantity) || 1))
    const engravingText = String(body.engravingText ?? "").trim() || undefined

    if (!customerName || customerName.length < 2) {
      return NextResponse.json({ error: "Bitte Namen angeben." }, { status: 400 })
    }
    if (!isValidContactEmail(customerEmail)) {
      return NextResponse.json({ error: "Bitte gültige E-Mail angeben." }, { status: 400 })
    }
    if (!material) {
      return NextResponse.json({ error: "Material fehlt." }, { status: 400 })
    }

    const productLengthMm = parsePositiveNumber(body.productLengthMm)
    const productWidthMm = parsePositiveNumber(body.productWidthMm)
    const productHeightMm = parsePositiveNumber(body.productHeightMm)
    if (!productLengthMm || !productWidthMm || !productHeightMm) {
      return NextResponse.json(
        { error: "Bitte Produktmasse (Länge, Breite, Höhe) angeben." },
        { status: 400 }
      )
    }

    const uploadedImageDataUrls = Array.isArray(body.uploadedImageDataUrls)
      ? body.uploadedImageDataUrls
          .map((entry) => parseDataUrl(entry))
          .filter((entry): entry is string => Boolean(entry))
          .slice(0, 8)
      : []

    const sent = await notifyAdminLaserAnfrage({
      customerName,
      customerEmail,
      customerPhone,
      message,
      material,
      categoryLabel,
      categoryFromPriceChf: Number.isFinite(categoryFromPriceChf)
        ? categoryFromPriceChf
        : undefined,
      productLengthMm,
      productWidthMm,
      productHeightMm,
      quantity,
      engravingText,
      mockupDataUrl: parseDataUrl(body.mockupDataUrl),
      productionLayerDataUrl: parseDataUrl(body.productionLayerDataUrl),
      productBackgroundDataUrl: parseDataUrl(body.productBackgroundDataUrl),
      uploadedImageDataUrls,
    })

    if (!sent) {
      return NextResponse.json(
        { error: "Anfrage konnte nicht gesendet werden. Bitte später erneut versuchen." },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: "Unverbindliche Anfrage wurde gesendet. Wir melden uns bei Ihnen.",
    })
  } catch (error) {
    console.error("Laser-Anfrage POST fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Anfrage fehlgeschlagen." },
      { status: 500 }
    )
  }
}
