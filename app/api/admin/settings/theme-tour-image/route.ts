import { NextResponse } from "next/server"
import {
  bufferToDataUrl,
  isImageContentType,
  MAX_IMAGE_DATA_URL_BYTES,
  uploadProductMediaBlob,
} from "@/lib/azure/upload-product-media"
import { getSettings, saveSettings } from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { normalizeThemeInboundTourImageUrl } from "@/lib/dripforge/theme-inbound-tour-settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ALLOWED_MIME = new Set(["image/png", "image/webp"])
const ALLOWED_EXT = new Set([".png", ".webp"])
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
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      : ""

    if (!ALLOWED_MIME.has(contentType) && !ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { error: "Nur PNG- oder WebP-Bilder mit Transparenz sind erlaubt." },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Die Datei ist leer." }, { status: 400 })
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { error: "Das Bild darf maximal 2 MB gross sein." },
        { status: 400 }
      )
    }

    const resolvedType =
      contentType && isImageContentType(contentType)
        ? contentType
        : ext === ".webp"
          ? "image/webp"
          : "image/png"

    let url = await uploadProductMediaBlob(
      "global-settings",
      "theme-inbound-tour",
      buffer,
      file.name,
      resolvedType
    )

    if (!url) {
      if (buffer.length <= MAX_IMAGE_DATA_URL_BYTES) {
        url = bufferToDataUrl(buffer, resolvedType)
      } else {
        return NextResponse.json(
          {
            error:
              "Upload fehlgeschlagen. Azure Storage konfigurieren oder kleinere Datei wählen.",
          },
          { status: 503 }
        )
      }
    }

    const normalizedUrl = normalizeThemeInboundTourImageUrl(url)
    if (!normalizedUrl) {
      return NextResponse.json(
        { error: "Upload-URL konnte nicht verarbeitet werden." },
        { status: 500 }
      )
    }

    const current = await getSettings()
    const settings = await saveSettings({
      checkout: current.checkout,
      enableOnboardingTour: current.enableOnboardingTour,
      onboardingTourText: current.onboardingTourText,
      themeInboundTourImageUrl: normalizedUrl,
    })

    return NextResponse.json({
      themeInboundTourImageUrl: settings.themeInboundTourImageUrl ?? normalizedUrl,
    })
  } catch (error) {
    console.warn("Admin: Theme-Tour-Bild-Upload fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Theme-Tour-Bild konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
