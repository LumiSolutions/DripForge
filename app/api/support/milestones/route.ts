import { NextResponse } from "next/server"
import {
  cosmosGetTotalSupportRaisedChf,
} from "@/lib/support/cosmos-supporters"
import { computeMilestoneProgress } from "@/lib/support/types"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await warmCosmosInfrastructure()
    const totalRaisedChf = await cosmosGetTotalSupportRaisedChf()
    const milestones = computeMilestoneProgress(totalRaisedChf)
    return NextResponse.json(
      { totalRaisedChf, milestones },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  } catch (error) {
    console.error("Support Milestones API: Laden fehlgeschlagen.", error)
    const milestones = computeMilestoneProgress(0)
    return NextResponse.json(
      { totalRaisedChf: 0, milestones },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    )
  }
}
