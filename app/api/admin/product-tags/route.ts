import { NextResponse } from "next/server"
import { resolveCosmosApiError } from "@/lib/admin/api-errors"
import { getProductTags, upsertProductTag } from "@/lib/admin/product-tag-db"
import { createProductTagId, normalizeProductTag } from "@/lib/admin/product-tags"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
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
    console.error("URSACHE COSMOS FEHLER (admin product-tags GET):", error)
    const { message, status } = resolveCosmosApiError(error)
    return NextResponse.json({ error: message, tags: [] }, { status })
  }
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as { name?: string; sortOrder?: number; group?: string }
    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: "Tag-Name fehlt." }, { status: 400 })
    }

    const tag = normalizeProductTag({
      id: createProductTagId(name),
      name,
      sortOrder: body.sortOrder,
      group: body.group,
    })
    const saved = await upsertProductTag(tag)
    const tags = await getProductTags()

    return NextResponse.json({ tag: saved, tags }, { status: 201 })
  } catch (error) {
    console.error("URSACHE COSMOS FEHLER (admin product-tags POST):", error)
    const { message, status } = resolveCosmosApiError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
