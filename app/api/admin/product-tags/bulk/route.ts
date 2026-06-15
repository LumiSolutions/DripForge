import { NextResponse } from "next/server"
import { resolveCosmosApiError } from "@/lib/admin/api-errors"
import { getAdminProducts, upsertProduct } from "@/lib/admin/db"
import {
  deleteProductTag,
  getProductTagById,
  upsertProductTag,
} from "@/lib/admin/product-tag-db"
import {
  normalizeProductTag,
  normalizeProductTagIds,
} from "@/lib/admin/product-tags"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type TagBulkBody = {
  ids?: string[]
  action?: "delete"
  group?: string
}

function parseIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))]
}

export async function PATCH(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as TagBulkBody
    const ids = parseIds(body.ids)

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Keine Tag-IDs angegeben." },
        { status: 400 }
      )
    }

    if (body.action === "delete") {
      for (const id of ids) {
        await deleteProductTag(id)
      }

      const products = await getAdminProducts()
      const idSet = new Set(ids)
      const affected = products.filter((product) =>
        normalizeProductTagIds(product.tags).some((tagId) => idSet.has(tagId))
      )

      await Promise.all(
        affected.map((product) =>
          upsertProduct({
            ...product,
            tags: normalizeProductTagIds(product.tags).filter(
              (tagId) => !idSet.has(tagId)
            ),
          })
        )
      )

      return NextResponse.json({ deleted: ids.length, ids })
    }

    const group = body.group?.trim()
    if (!group) {
      return NextResponse.json(
        { error: "Keine Bulk-Aktion angegeben." },
        { status: 400 }
      )
    }

    const updated = await Promise.all(
      ids.map(async (id) => {
        const current = await getProductTagById(id)
        if (!current) return null
        return upsertProductTag(
          normalizeProductTag({ ...current, id: current.id, group }, current)
        )
      })
    )

    const tags = updated.filter((tag) => tag != null)
    return NextResponse.json({ updated: tags.length, tags })
  } catch (error) {
    console.error("URSACHE COSMOS FEHLER (admin product-tags bulk PATCH):", error)
    const { message, status } = resolveCosmosApiError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
