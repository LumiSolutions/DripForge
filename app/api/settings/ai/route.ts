import { NextResponse } from "next/server"
import { getAiSettings } from "@/lib/admin/db"
import type { AiProductCategoryId } from "@/lib/ai/ai-settings-types"

export const dynamic = "force-dynamic"

export type PublicAiCategory = {
  id: AiProductCategoryId
  name: string
}

/** Öffentliche KI-Freigabe für Shop/Frontend (ohne Admin-Secrets). */
export async function GET() {
  try {
    const settings = await getAiSettings()
    const categories: PublicAiCategory[] = settings.categories
      .filter((c) => c.enabled)
      .map((c) => ({ id: c.id, name: c.name }))

    return NextResponse.json(
      {
        enabled: categories.length > 0,
        categories,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("Settings AI API: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      { enabled: false, categories: [] as PublicAiCategory[] },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  }
}
