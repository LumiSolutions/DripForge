import { NextResponse } from "next/server"
import type { PrintPriceBreakdown } from "@/lib/dripforge/calculate-3d-print-price"
import { createDruckanfrage } from "@/lib/admin/druckanfragen-db"
import {
  createDruckanfrageId,
  DRUCKANFRAGE_CONTACT_METHODS,
  isValidContactEmail,
  isValidContactPhone,
  MAX_DRUCKANFRAGE_FILE_BYTES,
  type DruckanfrageContactMethod,
  type DruckanfrageDimensionsMm,
} from "@/lib/admin/druckanfrage-types"
import { notifyAdminDruckanfrage } from "@/lib/admin/notify-druckanfrage-admin"
import { notifyAdminNewDruckanfrage } from "@/lib/email/admin-inbound-notifications"
import { notifyDruckanfrageReceived } from "@/lib/email/order-notifications"
import { uploadDruckanfrageFile } from "@/lib/azure/upload-druckanfrage-file"
import {
  bufferToDataUrl,
  isImageContentType,
  MAX_IMAGE_DATA_URL_BYTES,
} from "@/lib/azure/upload-product-media"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ALLOWED_MODEL_EXTENSIONS = new Set(["stl", "obj", "glb", "gltf", "3mf"])

function parseContactMethod(value: unknown): DruckanfrageContactMethod | null {
  return DRUCKANFRAGE_CONTACT_METHODS.includes(value as DruckanfrageContactMethod)
    ? (value as DruckanfrageContactMethod)
    : null
}

function parseDimensions(value: unknown): DruckanfrageDimensionsMm | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const x = Number(raw.x)
  const y = Number(raw.y)
  const z = Number(raw.z)
  if ([x, y, z].some((n) => Number.isNaN(n) || n <= 0)) return null
  return { x, y, z }
}

function parsePriceBreakdown(value: unknown): PrintPriceBreakdown | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<PrintPriceBreakdown>
  if (typeof raw.totalPrice !== "number" || typeof raw.unitPrice !== "number") return null
  return raw as PrintPriceBreakdown
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => String(entry).trim()).filter(Boolean)
}

function resolveModelContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  if (ext === "stl") return "model/stl"
  if (ext === "obj") return "model/obj"
  if (ext === "glb") return "model/gltf-binary"
  if (ext === "gltf") return "model/gltf+json"
  if (ext === "3mf") return "application/vnd.ms-package.3dmanufacturing-3dmodel+xml"
  return "application/octet-stream"
}

async function uploadOptionalImage(
  anfrageId: string,
  category: "leitbild" | "color-reference",
  file: File | null
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_IMAGE_DATA_URL_BYTES) {
    const url = await uploadDruckanfrageFile(
      anfrageId,
      category,
      buffer,
      file.name,
      file.type || "image/png"
    )
    return url
  }

  const contentType =
    file.type && isImageContentType(file.type) ? file.type : "image/png"
  const url = await uploadDruckanfrageFile(
    anfrageId,
    category,
    buffer,
    file.name,
    contentType
  )
  if (url) return url
  return bufferToDataUrl(buffer, contentType)
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const modelFile = formData.get("modelFile")
    const metadataRaw = formData.get("metadata")
    const leitbildFile = formData.get("leitbild")
    const colorReferenceFile = formData.get("colorReferenceImage")

    if (!(modelFile instanceof File)) {
      return NextResponse.json({ error: "Modell-Datei fehlt." }, { status: 400 })
    }

    if (modelFile.size === 0) {
      return NextResponse.json({ error: "Die Modell-Datei ist leer." }, { status: 400 })
    }

    if (modelFile.size > MAX_DRUCKANFRAGE_FILE_BYTES) {
      return NextResponse.json(
        { error: "Die Modell-Datei darf maximal 50 MB gross sein." },
        { status: 400 }
      )
    }

    const extension = modelFile.name.split(".").pop()?.toLowerCase()
    if (!extension || !ALLOWED_MODEL_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: "Nur STL, OBJ, GLB, GLTF oder 3MF sind erlaubt." },
        { status: 400 }
      )
    }

    if (typeof metadataRaw !== "string" || !metadataRaw.trim()) {
      return NextResponse.json({ error: "Metadaten fehlen." }, { status: 400 })
    }

    let metadata: Record<string, unknown>
    try {
      metadata = JSON.parse(metadataRaw) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Metadaten sind ungueltig." }, { status: 400 })
    }

    const contactMethod = parseContactMethod(metadata.contactMethod)
    const customerEmail = String(metadata.customerEmail ?? "").trim()
    const customerPhone = String(metadata.customerPhone ?? "").trim()
    const dimensionsMm = parseDimensions(metadata.dimensionsMm)
    const priceBreakdown = parsePriceBreakdown(metadata.priceBreakdown)
    const quantity = Number(metadata.quantity)
    const scalePercent = Number(metadata.scalePercent)

    if (!contactMethod) {
      return NextResponse.json(
        { error: "Bitte waehlen Sie einen Kontaktkanal." },
        { status: 400 }
      )
    }

    if (contactMethod === "email") {
      if (!customerEmail || !isValidContactEmail(customerEmail)) {
        return NextResponse.json(
          { error: "Bitte geben Sie eine gueltige E-Mail-Adresse an." },
          { status: 400 }
        )
      }
    }

    if (contactMethod === "whatsapp") {
      if (!customerPhone || !isValidContactPhone(customerPhone)) {
        return NextResponse.json(
          { error: "Bitte geben Sie eine gueltige Telefonnummer fuer WhatsApp an." },
          { status: 400 }
        )
      }
    }

    if (!dimensionsMm || !priceBreakdown || !Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json(
        { error: "Preis- oder Modellangaben sind unvollstaendig." },
        { status: 400 }
      )
    }

    if (!Number.isFinite(scalePercent) || scalePercent <= 0) {
      return NextResponse.json({ error: "Skalierung ist ungueltig." }, { status: 400 })
    }

    const filamentMaterial = String(metadata.filamentMaterial ?? "").trim()
    const filamentColors = parseStringArray(metadata.filamentColors)

    if (!filamentMaterial || filamentColors.length === 0) {
      return NextResponse.json(
        { error: "Bitte waehlen Sie Material und mindestens eine Farbe." },
        { status: 400 }
      )
    }

    const draftId = createDruckanfrageId()
    const modelBuffer = Buffer.from(await modelFile.arrayBuffer())
    let fileUrl = await uploadDruckanfrageFile(
      draftId,
      "model",
      modelBuffer,
      modelFile.name,
      modelFile.type || resolveModelContentType(modelFile.name)
    )

    if (!fileUrl && modelBuffer.length <= 512 * 1024) {
      fileUrl = `data:application/octet-stream;base64,${modelBuffer.toString("base64")}`
    }

    const leitbildUrl = await uploadOptionalImage(
      draftId,
      "leitbild",
      leitbildFile instanceof File ? leitbildFile : null
    )
    const colorReferenceImageUrl = await uploadOptionalImage(
      draftId,
      "color-reference",
      colorReferenceFile instanceof File ? colorReferenceFile : null
    )

    const anfrage = await createDruckanfrage(
      {
        contactMethod,
        customerEmail,
        customerPhone: customerPhone || undefined,
        fileName: modelFile.name,
        fileUrl,
        fileSizeBytes: modelFile.size,
        leitbildUrl,
        colorReferenceImageUrl,
        quantity: Math.round(quantity),
        scalePercent: Math.round(scalePercent),
        dimensionsMm,
        volumeCm3: Number(metadata.volumeCm3) || priceBreakdown.volumeCm3,
        filamentMaterial,
        filamentColors,
        colorWishes: String(metadata.colorWishes ?? "").trim() || undefined,
        hasEmbeddedModelColors: Boolean(metadata.hasEmbeddedModelColors),
        estimatedUnitPrice: priceBreakdown.unitPrice,
        estimatedTotalPrice: priceBreakdown.totalPrice,
        priceBreakdown,
      },
      draftId
    )

    const notifications: Promise<unknown>[] = [
      notifyAdminDruckanfrage(anfrage),
      notifyAdminNewDruckanfrage(anfrage),
    ]

    if (contactMethod === "email") {
      notifications.push(
        notifyDruckanfrageReceived({
          customerEmail,
          anfrageId: anfrage.id,
          fileName: modelFile.name,
          estimatedTotalPrice: priceBreakdown.totalPrice,
        })
      )
    }

    const results = await Promise.allSettled(notifications)
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(
          `[Druckanfrage] Benachrichtigung fehlgeschlagen (${anfrage.id}).`,
          result.reason
        )
      }
    }

    return NextResponse.json({
      ok: true,
      anfrageId: anfrage.id,
      message:
        "Ihre unverbindliche Anfrage wurde uebermittelt. Wir melden uns mit dem exakten Festpreis.",
    })
  } catch (error) {
    console.error("[Druckanfrage] Speichern fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Die Druckanfrage konnte nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
