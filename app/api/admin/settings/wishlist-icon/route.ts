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
import { normalizeWishlistIconCustomUrl } from "@/lib/dripforge/wishlist-icon-settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ALLOWED_MIME = new Set([
  "image/svg+xml",
  "image/png",
  "image/webp",
])
const ALLOWED_EXT = new Set([".svg", ".png", ".webp"])
const MAX_BYTES = 512 * 1024

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
        { error: "Nur SVG, PNG oder WebP sind erlaubt." },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Die Datei ist leer." }, { status: 400 })
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { error: "Die Datei darf maximal 512 KB gross sein." },
        { status: 400 }
      )
    }

    const resolvedType =
      contentType &&
      (isImageContentType(contentType) || contentType === "image/svg+xml")
        ? contentType
        : ext === ".svg"
          ? "image/svg+xml"
          : ext === ".webp"
            ? "image/webp"
            : "image/png"

    let url = await uploadProductMediaBlob(
      "global-settings",
      "wishlist-icon",
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
          { status: 502 }
        )
      }
    }

    const current = await getSettings()
    const settings = await saveSettings({
      checkout: current.checkout,
      wishlistIcon: "custom",
      wishlistIconCustomUrl: normalizeWishlistIconCustomUrl(url),
    })

    return NextResponse.json({
      wishlistIcon: settings.wishlistIcon,
      wishlistIconCustomUrl: settings.wishlistIconCustomUrl,
    })
  } catch (error) {
    console.warn("Wishlist icon upload failed.", error)
    return NextResponse.json(
      { error: "Upload fehlgeschlagen." },
      { status: 500 }
    )
  }
}
