import { NextResponse } from "next/server"
import { resolveCosmosApiError } from "@/lib/admin/api-errors"
import { getProductTags } from "@/lib/admin/product-tag-db"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const tags = await getProductTags()
    return NextResponse.json(
      { tags },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("URSACHE COSMOS FEHLER (product-tags GET):", error)
    const { message, status } = resolveCosmosApiError(error)
    return NextResponse.json({ tags: [], error: message }, { status })
  }
}
