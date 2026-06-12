import { NextResponse } from "next/server"
import { getAiSettings } from "@/lib/admin/db"
import { getAiCategoryById } from "@/lib/ai/ai-settings-types"
import { generate3dModel } from "@/lib/ai/generate-3d-provider"
import { logThreeDGeneratorDevHint } from "@/lib/ai/three-d-generator-config"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { getSessionEmailFromRequest } from "@/lib/konto/api-auth"
import { consumeAiCredit, refundAiCredit } from "@/lib/konto/ai-credits"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_PROMPT_LENGTH = 2000
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export async function POST(request: Request) {
  try {
    await warmCosmosInfrastructure()

    const email = await getSessionEmailFromRequest()
    if (!email) {
      return NextResponse.json(
        { error: "Bitte melde dich an, um KI-Generierungen zu nutzen." },
        { status: 401 }
      )
    }

    const creditUse = await consumeAiCredit(email)
    if (!creditUse.success) {
      return NextResponse.json(
        {
          error:
            "Keine KI-Credits mehr vorhanden. Kontaktiere uns oder tätige eine Bestellung, um neue Credits zu erhalten.",
          remainingAiCredits: 0,
        },
        { status: 402 }
      )
    }

    const contentType = request.headers.get("content-type") ?? ""
    let userPrompt = ""
    let categoryId = "lampen"
    let referenceImageBase64: string | null = null
    let referenceImageMimeType: string | null = null

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData()
      userPrompt = String(form.get("prompt") ?? form.get("userPrompt") ?? "").trim()
      categoryId = String(form.get("categoryId") ?? "lampen").trim()
      const imageFile = form.get("image")
      if (imageFile instanceof File && imageFile.size > 0) {
        if (imageFile.size > MAX_IMAGE_BYTES) {
          return NextResponse.json(
            { error: "Bild darf maximal 8 MB gross sein." },
            { status: 400 }
          )
        }
        const buffer = Buffer.from(await imageFile.arrayBuffer())
        referenceImageBase64 = buffer.toString("base64")
        referenceImageMimeType = imageFile.type || "image/png"
      }
    } else {
      const body = (await request.json()) as {
        prompt?: string
        userPrompt?: string
        categoryId?: string
        referenceImageBase64?: string
        referenceImageMimeType?: string
      }
      userPrompt = String(body.prompt ?? body.userPrompt ?? "").trim()
      categoryId = String(body.categoryId ?? "lampen").trim()
      referenceImageBase64 = body.referenceImageBase64 ?? null
      referenceImageMimeType = body.referenceImageMimeType ?? null
    }

    if (!userPrompt) {
      await refundAiCredit(email)
      return NextResponse.json(
        { error: "Bitte beschreibe dein Wunschmodell." },
        { status: 400 }
      )
    }
    if (userPrompt.length > MAX_PROMPT_LENGTH) {
      await refundAiCredit(email)
      return NextResponse.json(
        { error: `Prompt darf maximal ${MAX_PROMPT_LENGTH} Zeichen lang sein.` },
        { status: 400 }
      )
    }

    const aiSettings = await getAiSettings()
    const category = getAiCategoryById(aiSettings, categoryId)
    if (!category || !category.enabled) {
      await refundAiCredit(email)
      return NextResponse.json(
        { error: "Produktkategorie nicht verfügbar oder deaktiviert." },
        { status: 400 }
      )
    }

    let result
    try {
      result = await generate3dModel(
        {
          userPrompt,
          categoryId: category.id,
          referenceImageBase64,
          referenceImageMimeType,
        },
        category
      )
    } catch (genError) {
      await refundAiCredit(email)
      throw genError
    }

    if (result.provider === "simulation") {
      logThreeDGeneratorDevHint("POST /api/generate-3d")
    }

    return NextResponse.json(
      { ...result, remainingAiCredits: creditUse.remaining },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    )
  } catch (error) {
    console.error("Generate-3D API: Fehler.", error)
    return NextResponse.json(
      { error: "3D-Generierung konnte nicht gestartet werden." },
      { status: 500 }
    )
  }
}
