import { NextResponse } from "next/server"
import {
  bufferToDataUrl,
  isImageContentType,
  MAX_IMAGE_DATA_URL_BYTES,
  uploadProductMediaBlob,
} from "@/lib/azure/upload-product-media"
import {
  getDocumentTemplateSettings,
  saveDocumentTemplateSettings,
} from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"])
const MAX_BYTES = 2 * 1024 * 1024

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Keine Datei erhalten." }, { status: 400 })
    }

    const contentType = (file.type || "").toLowerCase()
    if (!ALLOWED_MIME.has(contentType) && !file.name.match(/\.(png|jpe?g|webp|svg)$/i)) {
      return NextResponse.json(
        { error: "Nur PNG, JPEG, WebP oder SVG sind erlaubt." },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Die Datei ist leer." }, { status: 400 })
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { error: "Das Logo darf maximal 2 MB gross sein." },
        { status: 400 }
      )
    }

    const resolvedType =
      contentType && isImageContentType(contentType) ? contentType : "image/png"

    let url = await uploadProductMediaBlob(
      "document-template",
      "logo",
      buffer,
      file.name,
      resolvedType
    )

    if (!url && buffer.length <= MAX_IMAGE_DATA_URL_BYTES) {
      url = bufferToDataUrl(buffer, resolvedType)
    }

    if (!url) {
      return NextResponse.json(
        { error: "Logo-Upload fehlgeschlagen. Azure Storage konfigurieren oder kleinere Datei waehlen." },
        { status: 503 }
      )
    }

    const current = await getDocumentTemplateSettings()
    const saved = await saveDocumentTemplateSettings({
      ...current,
      logoUrl: url,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ logoUrl: saved.logoUrl, template: saved })
  } catch (error) {
    console.error("Admin: Dokumentenlogo-Upload fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Dokumentenlogo konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
