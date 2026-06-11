import { NextResponse } from "next/server"
import { cosmosGetSupportCategoryTotals } from "@/lib/support/cosmos-supporters"
import {
  computeMilestoneProgress,
  totalRaisedFromCategories,
} from "@/lib/support/types"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const categoryTotals = await cosmosGetSupportCategoryTotals()
    const milestones = computeMilestoneProgress(categoryTotals)
    const totalRaisedChf = totalRaisedFromCategories(categoryTotals)
    return NextResponse.json(
      { totalRaisedChf, categoryTotals, milestones },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("Support Milestones API: Laden fehlgeschlagen.", error)
    const milestones = computeMilestoneProgress()
    return NextResponse.json(
      { totalRaisedChf: 0, categoryTotals: null, milestones },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  }
}
