import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Liefert das Marken-Icon (Slot 1) mit korrektem Content-Type, damit Favicon /
 * Apple-Touch-Icon in allen Browsern (inkl. Safari) zuverlässig dargestellt
 * werden — statt einer unzuverlässigen data:-URL im <link>. Fällt auf das
 * Standard-Icon zurück, wenn kein Marken-Icon gesetzt ist.
 */
export async function GET(request: Request) {
  let iconUrl: string | null = null
  try {
    const settings = await getSettings()
    iconUrl = settings.brandIconUrl?.trim() || null
  } catch {
    iconUrl = null
  }

  if (!iconUrl) {
    return NextResponse.redirect(new URL("/icon.svg", request.url), 307)
  }

  // Data-URL: dekodieren und mit passendem MIME-Type ausliefern.
  const dataMatch = iconUrl.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/)
  if (dataMatch) {
    const mime = dataMatch[1] || "image/png"
    const isBase64 = Boolean(dataMatch[2])
    const payload = dataMatch[3] ?? ""
    const buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf-8")
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=60",
      },
    })
  }

  // Absolute URL (z. B. Azure Blob) → weiterleiten.
  if (/^https?:\/\//i.test(iconUrl)) {
    return NextResponse.redirect(iconUrl, 307)
  }

  // Relativer Pfad → als lokale URL weiterleiten.
  return NextResponse.redirect(new URL(iconUrl, request.url), 307)
}
