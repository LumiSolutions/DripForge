import { NextResponse } from "next/server"
import { resolveCosmosApiError } from "@/lib/admin/api-errors"
import {
  deleteProductTag,
  getProductTagById,
  upsertProductTag,
} from "@/lib/admin/product-tag-db"
import { getAdminProducts, upsertProduct } from "@/lib/admin/db"
import { normalizeProductTag, normalizeProductTagIds } from "@/lib/admin/product-tags"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  const { id } = await context.params

  try {
    await warmCosmosInfrastructure()
    const current = await getProductTagById(id)
    if (!current) {
      return NextResponse.json({ error: "Tag nicht gefunden." }, { status: 404 })
    }

    const body = (await request.json()) as { name?: string; sortOrder?: number }
    const saved = await upsertProductTag(
      normalizeProductTag({ ...current, ...body, id: current.id }, current)
    )
    return NextResponse.json({ tag: saved })
  } catch (error) {
    console.error("URSACHE COSMOS FEHLER (admin product-tags PATCH):", error)
    const { message, status } = resolveCosmosApiError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  const { id } = await context.params

  try {
    await warmCosmosInfrastructure()
    const removed = await deleteProductTag(id)
    if (!removed) {
      return NextResponse.json({ error: "Tag nicht gefunden." }, { status: 404 })
    }

    const products = await getAdminProducts()
    await Promise.all(
      products
        .filter((product) => normalizeProductTagIds(product.tags).includes(id))
        .map((product) =>
          upsertProduct({
            ...product,
            tags: normalizeProductTagIds(product.tags).filter((tagId) => tagId !== id),
          })
        )
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("URSACHE COSMOS FEHLER (admin product-tags DELETE):", error)
    const { message, status } = resolveCosmosApiError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
