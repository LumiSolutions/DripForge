import { NextResponse } from "next/server"
import { getSettings } from "@/lib/admin/db"
import { cosmosGetSupportCategoryTotals } from "@/lib/support/cosmos-supporters"
import {
  computeMilestoneProgress,
  totalRaisedFromCategories,
} from "@/lib/support/types"
import {
  getPublicSupportFeatures,
  normalizeSupportMilestones,
} from "@/lib/dripforge/support-page-settings"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const [categoryTotals, settings] = await Promise.all([
      cosmosGetSupportCategoryTotals(),
      getSettings().catch(() => null),
    ])
    const milestoneConfigs = normalizeSupportMilestones(
      settings?.supportMilestones
    )
    const milestones = computeMilestoneProgress(
      categoryTotals,
      milestoneConfigs
    )
    const features = getPublicSupportFeatures(settings?.supportFeatures)
    const totalRaisedChf = totalRaisedFromCategories(categoryTotals)
    return NextResponse.json(
      { totalRaisedChf, categoryTotals, milestones, features },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("Support Milestones API: Laden fehlgeschlagen.", error)
    const milestones = computeMilestoneProgress()
    return NextResponse.json(
      {
        totalRaisedChf: 0,
        categoryTotals: null,
        milestones,
        features: getPublicSupportFeatures(undefined),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  }
}
