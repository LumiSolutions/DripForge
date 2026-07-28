import { NextResponse } from "next/server"
import {
  downloadBlobAsBuffer,
  parseAllowedBlobUrl,
} from "@/lib/azure/download-blob"
import { sanitizeFilename } from "@/lib/admin/sanitize-filename"
import {
  getOrderForCustomerEmail,
} from "@/lib/konto/customer-orders"
import {
  isCustomerAuthError,
  requireCustomerSession,
} from "@/lib/konto/customer-api-auth"

type RouteContext = {
  params: Promise<{ orderId: string; itemId: string }>
}

type AssetType = "leitbild" | "logo" | "skizze"

function resolveAssetSource(
  orderId: string,
  itemId: string,
  type: AssetType,
  order: NonNullable<Awaited<ReturnType<typeof getOrderForCustomerEmail>>>
): { src: string; filename: string } | null {
  const item = order.items.find((entry) => entry.id === itemId)
  if (!item) return null

  const details = item.customDetails

  if (type === "leitbild") {
    const src = item.leitbildUrl ?? item.leitbild
    if (!src) return null
    return {
      src,
      filename: sanitizeFilename(`${orderId}-${itemId}-leitbild.png`),
    }
  }

  if (type === "logo" && details?.uploadedImage) {
    return {
      src: details.uploadedImage,
      filename: sanitizeFilename(`${orderId}-${itemId}-logo.png`),
    }
  }

  if (type === "skizze" && details?.colorReferenceImage) {
    return {
      src: details.colorReferenceImage,
      filename: sanitizeFilename(
        details.colorReferenceImageName ?? `${orderId}-${itemId}-skizze.png`
      ),
    }
  }

  return null
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireCustomerSession()
  if (isCustomerAuthError(auth)) return auth

  const { orderId, itemId } = await context.params
  const type = new URL(request.url).searchParams.get("type") as AssetType | null

  if (!type || !["leitbild", "logo", "skizze"].includes(type)) {
    return NextResponse.json({ error: "Ungültiger Asset-Typ." }, { status: 400 })
  }

  const order = await getOrderForCustomerEmail(auth.email, orderId)
  if (!order) {
    return NextResponse.json({ error: "Bestellung nicht gefunden." }, { status: 404 })
  }

  const asset = resolveAssetSource(orderId, itemId, type, order)
  if (!asset) {
    return NextResponse.json({ error: "Datei nicht verfügbar." }, { status: 404 })
  }

  if (asset.src.startsWith("data:")) {
    const match = asset.src.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      return NextResponse.json({ error: "Datei konnte nicht gelesen werden." }, { status: 500 })
    }
    const buffer = Buffer.from(match[2], "base64")
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": match[1],
        "Content-Disposition": `attachment; filename="${asset.filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  }

  const parsed = parseAllowedBlobUrl(asset.src)
  if (!parsed) {
    return NextResponse.json({ error: "Ungültige Datei-URL." }, { status: 400 })
  }

  const file = await downloadBlobAsBuffer(parsed.container, parsed.blobName)
  if (!file) {
    return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${asset.filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
