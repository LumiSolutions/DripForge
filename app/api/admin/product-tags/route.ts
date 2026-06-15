import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import { getProductTags, upsertProductTag } from "@/lib/admin/product-tag-db"
import { createProductTagId, normalizeProductTag } from "@/lib/admin/product-tags"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { formatCosmosError } from "@/lib/cosmos/log-error"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const tags = await getProductTags()
    return NextResponse.json({ tags })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin product-tags GET:", formatCosmosError(error))
    return NextResponse.json(
      { error: "Tags konnten nicht geladen werden.", tags: [] },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as { name?: string; sortOrder?: number }
    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: "Tag-Name fehlt." }, { status: 400 })
    }

    const tag = normalizeProductTag({
      id: createProductTagId(name),
      name,
      sortOrder: body.sortOrder,
    })
    const saved = await upsertProductTag(tag)
    const tags = await getProductTags()

    return NextResponse.json({ tag: saved, tags }, { status: 201 })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin product-tags POST:", formatCosmosError(error))
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Tag konnte nicht erstellt werden.",
      },
      { status: 500 }
    )
  }
}
