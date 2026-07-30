import { NextResponse } from "next/server"
import {
  downloadBlobAsBuffer,
  parseAllowedBlobUrl,
} from "@/lib/azure/download-blob"
import { sanitizeFilename } from "@/lib/admin/sanitize-filename"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  const url = new URL(request.url)
  const blobUrl = url.searchParams.get("url")?.trim()
  if (!blobUrl) {
    return NextResponse.json({ error: "URL fehlt." }, { status: 400 })
  }

  const parsed = parseAllowedBlobUrl(blobUrl)
  if (!parsed) {
    return NextResponse.json({ error: "Ungültige Blob-URL." }, { status: 400 })
  }

  try {
    const file = await downloadBlobAsBuffer(parsed.container, parsed.blobName)
    if (!file) {
      return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 })
    }

    const requestedName = url.searchParams.get("filename")?.trim()
    const filename = sanitizeFilename(
      requestedName ||
        parsed.blobName.split("/").pop() ||
        "download.bin"
    )

    const lower = filename.toLowerCase()
    let contentType = file.contentType
    if (lower.endsWith(".stl")) contentType = "model/stl"
    else if (lower.endsWith(".3mf")) contentType = "model/3mf"
    else if (lower.endsWith(".gcode")) contentType = "text/plain"

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("Admin: Blob-Download fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Download fehlgeschlagen." },
      { status: 500 }
    )
  }
}
