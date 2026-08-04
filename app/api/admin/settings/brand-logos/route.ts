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
import { normalizeBrandUrl } from "@/lib/admin/branding-settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ALLOWED_MIME = new Set([
  "image/svg+xml",
  "image/png",
  "image/webp",
  "image/jpeg",
  "image/x-icon",
  "image/vnd.microsoft.icon",
])
const ALLOWED_EXT = new Set([".svg", ".png", ".webp", ".jpg", ".jpeg", ".ico"])
const MAX_BYTES = 1024 * 1024

function resolveSlotField(slot: string): "brandIconUrl" | "brandLogoUrl" | null {
  if (slot === "icon") return "brandIconUrl"
  if (slot === "logo") return "brandLogoUrl"
  return null
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const formData = await request.formData()
    const file = formData.get("file")
    const slot = String(formData.get("slot") ?? "").trim()
    const field = resolveSlotField(slot)

    if (!field) {
      return NextResponse.json(
        { error: "Ungültiger Slot (icon oder logo erwartet)." },
        { status: 400 }
      )
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Keine Datei erhalten." }, { status: 400 })
    }

    const contentType = (file.type || "").toLowerCase()
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      : ""

    if (!ALLOWED_MIME.has(contentType) && !ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { error: "Nur SVG, PNG, WebP, JPG oder ICO sind erlaubt." },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Die Datei ist leer." }, { status: 400 })
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { error: "Die Datei darf maximal 1 MB gross sein." },
        { status: 400 }
      )
    }

    const resolvedType =
      contentType && (isImageContentType(contentType) || contentType.includes("icon"))
        ? contentType
        : ext === ".svg"
          ? "image/svg+xml"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".ico"
              ? "image/x-icon"
              : ext === ".jpg" || ext === ".jpeg"
                ? "image/jpeg"
                : "image/png"

    let url = await uploadProductMediaBlob(
      "global-settings",
      `brand-${slot}`,
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
      [field]: normalizeBrandUrl(url),
    })

    return NextResponse.json({
      brandIconUrl: settings.brandIconUrl ?? null,
      brandLogoUrl: settings.brandLogoUrl ?? null,
    })
  } catch (error) {
    console.warn("Brand logo upload failed.", error)
    return NextResponse.json({ error: "Upload fehlgeschlagen." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { searchParams } = new URL(request.url)
    const field = resolveSlotField((searchParams.get("slot") ?? "").trim())
    if (!field) {
      return NextResponse.json({ error: "Ungültiger Slot." }, { status: 400 })
    }
    const current = await getSettings()
    const settings = await saveSettings({
      checkout: current.checkout,
      [field]: null,
    })
    return NextResponse.json({
      brandIconUrl: settings.brandIconUrl ?? null,
      brandLogoUrl: settings.brandLogoUrl ?? null,
    })
  } catch (error) {
    console.warn("Brand logo remove failed.", error)
    return NextResponse.json({ error: "Entfernen fehlgeschlagen." }, { status: 500 })
  }
}
