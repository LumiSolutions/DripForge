import { NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"
import { convertBeleg } from "@/lib/documents/beleg-service"
import type { BelegType } from "@/lib/documents/beleg-types"

function isAuthError(value: unknown): value is NextResponse {
  return value instanceof NextResponse
}

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Ctx) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const { id } = await context.params
    const body = (await request.json()) as { targetType?: BelegType }
    const targetType = body.targetType
    if (targetType !== "rechnung" && targetType !== "lieferschein") {
      return NextResponse.json({ error: "Ungültiges Umwandlungsziel." }, { status: 400 })
    }

    const beleg = await convertBeleg(decodeURIComponent(id), targetType)
    return NextResponse.json({ beleg }, { status: 201 })
  } catch (error) {
    console.error("Beleg convert fehlgeschlagen.", formatCosmosError(error))
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Umwandlung fehlgeschlagen.",
      },
      { status: 400 }
    )
  }
}
