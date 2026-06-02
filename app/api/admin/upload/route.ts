import { NextResponse } from "next/server"
import {
  bufferToDataUrl,
  isImageContentType,
  MAX_IMAGE_DATA_URL_BYTES,
  uploadProductMediaBlob,
} from "@/lib/azure/upload-product-media"

const MODEL_EXTENSIONS = [".stl", ".obj", ".glb", ".gltf"]

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    const productId = String(formData.get("productId") ?? "temp")
    const category = String(formData.get("category") ?? "gallery")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Keine Datei erhalten." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType = file.type || "application/octet-stream"
    const ext = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      : ""

    if (category === "model" && !MODEL_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Nur .stl, .obj, .glb oder .gltf erlaubt." },
        { status: 400 }
      )
    }

    let url = await uploadProductMediaBlob(
      productId,
      category,
      buffer,
      file.name,
      contentType
    )

    if (!url) {
      if (isImageContentType(contentType) && buffer.length <= MAX_IMAGE_DATA_URL_BYTES) {
        url = bufferToDataUrl(buffer, contentType)
      } else if (category === "model") {
        return NextResponse.json(
          {
            error:
              "3D-Datei konnte nicht gespeichert werden. Azure Storage konfigurieren.",
          },
          { status: 503 }
        )
      } else {
        return NextResponse.json(
          { error: "Upload fehlgeschlagen. Datei zu gross oder Storage nicht verfuegbar." },
          { status: 503 }
        )
      }
    }

    return NextResponse.json({ url, filename: file.name })
  } catch (error) {
    console.warn("Admin-Upload: Verarbeitung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Upload fehlgeschlagen." },
      { status: 500 }
    )
  }
}
