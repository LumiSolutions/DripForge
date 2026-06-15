import { NextResponse } from "next/server"
import { getProductTags } from "@/lib/admin/product-tag-db"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"

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
    console.error("Product-Tags API: Laden fehlgeschlagen.", formatCosmosError(error))
    return NextResponse.json({ tags: [] })
  }
}
