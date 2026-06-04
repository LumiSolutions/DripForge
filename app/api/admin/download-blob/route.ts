import { NextResponse } from "next/server"
import {
  downloadBlobAsBuffer,
  parseAllowedBlobUrl,
} from "@/lib/azure/download-blob"
import { sanitizeFilename } from "@/lib/admin/sanitize-filename"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const blobUrl = url.searchParams.get("url")?.trim()
  if (!blobUrl) {
    return NextResponse.json({ error: "URL fehlt." }, { status: 400 })
  }

  const parsed = parseAllowedBlobUrl(blobUrl)
  if (!parsed) {
    return NextResponse.json({ error: "Ungueltige Blob-URL." }, { status: 400 })
  }

  try {
    const file = await downloadBlobAsBuffer(parsed.container, parsed.blobName)
    if (!file) {
      return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 })
    }

    const filename = sanitizeFilename(
      parsed.blobName.split("/").pop() ?? "download.bin"
    )

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.contentType,
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
