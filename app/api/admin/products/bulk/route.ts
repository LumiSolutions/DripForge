import { NextResponse } from "next/server"
import { resolveCosmosApiError } from "@/lib/admin/api-errors"
import {
  deleteProduct,
  getAdminProducts,
  upsertProduct,
} from "@/lib/admin/db"
import { normalizeAdminProductInput } from "@/lib/admin/normalize-product"
import { normalizeProductTagIds } from "@/lib/admin/product-tags"
import {
  isProductShopStatus,
  productFieldsFromShopStatus,
  type ProductShopStatus,
} from "@/lib/admin/product-status"
import {
  inferSaleRabattFromProduct,
  resolveProductBasisPreis,
  validateSaleDiscount,
  type SaleRabattTyp,
} from "@/lib/dripforge/product-sale"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { AdminProduct } from "@/lib/admin/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type ProductBulkPatch = {
  istAktiv?: boolean
  sale?: boolean
  /** Kurzstatus active | sale | inactive — wird auf istAktiv/sale gemappt */
  status?: ProductShopStatus
  saleRabattTyp?: SaleRabattTyp
  saleRabattWert?: number
  tagsAdd?: string[]
  tagsRemove?: string[]
}

type BulkBody = {
  ids?: string[]
  action?: "delete"
  patch?: ProductBulkPatch
}

function parseIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))]
}

async function applyPatchToProduct(
  existing: AdminProduct,
  patch: ProductBulkPatch
): Promise<AdminProduct> {
  let tags = normalizeProductTagIds(existing.tags)
  if (patch.tagsAdd?.length) {
    tags = [...new Set([...tags, ...normalizeProductTagIds(patch.tagsAdd)])]
  }
  if (patch.tagsRemove?.length) {
    const remove = new Set(normalizeProductTagIds(patch.tagsRemove))
    tags = tags.filter((id) => !remove.has(id))
  }

  const input: Partial<AdminProduct> & {
    variantenText?: string
    basisPreis?: number
    status?: ProductShopStatus
  } = {
    ...existing,
    tags,
  }

  if (isProductShopStatus(patch.status)) {
    const fields = productFieldsFromShopStatus(patch.status)
    input.istAktiv = fields.istAktiv
    if (fields.sale !== undefined) {
      input.sale = fields.sale
    }
    if (patch.status === "sale") {
      const basisPreis =
        existing.basisPreis ?? existing.originalPrice ?? existing.price
      input.basisPreis = basisPreis
      const typ = patch.saleRabattTyp
      const wert = patch.saleRabattWert
      if (typ && wert != null) {
        const validation = validateSaleDiscount(basisPreis, typ, wert)
        if (validation) {
          throw new Error(validation)
        }
        input.saleRabattTyp = typ
        input.saleRabattWert = wert
      } else if (!existing.sale) {
        const inferred = inferSaleRabattFromProduct(existing)
        input.saleRabattTyp = inferred.typ
        input.saleRabattWert = inferred.wert
      }
    }
  } else {
    if (patch.istAktiv !== undefined) {
      input.istAktiv = patch.istAktiv
    }

    if (patch.sale !== undefined) {
      input.sale = patch.sale
      const basisPreis =
        existing.basisPreis ?? existing.originalPrice ?? existing.price
      input.basisPreis = basisPreis

      if (patch.sale) {
        const typ = patch.saleRabattTyp
        const wert = patch.saleRabattWert
        if (typ && wert != null) {
          const validation = validateSaleDiscount(basisPreis, typ, wert)
          if (validation) {
            throw new Error(validation)
          }
          input.saleRabattTyp = typ
          input.saleRabattWert = wert
        } else if (!existing.sale) {
          const inferred = inferSaleRabattFromProduct(existing)
          input.saleRabattTyp = inferred.typ
          input.saleRabattWert = inferred.wert
        }
      }
    }
  }

  return normalizeAdminProductInput(input, existing)
}

export async function PATCH(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as BulkBody
    const ids = parseIds(body.ids)

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Keine Produkt-IDs angegeben." },
        { status: 400 }
      )
    }

    if (body.action === "delete") {
      const results = await Promise.all(ids.map((id) => deleteProduct(id)))
      return NextResponse.json({
        deleted: results.filter(Boolean).length,
        ids,
      })
    }

    const patch = body.patch
    if (!patch || Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Keine Bulk-Aktion angegeben." },
        { status: 400 }
      )
    }

    const products = await getAdminProducts()
    const byId = new Map(products.map((product) => [product.id, product]))
    const targets = ids.map((id) => byId.get(id)).filter((p): p is AdminProduct => p != null)

    if (targets.length === 0) {
      return NextResponse.json(
        { error: "Keine gültigen Produkte gefunden." },
        { status: 404 }
      )
    }

    const updated = await Promise.all(
      targets.map(async (existing) => {
        if (patch.sale && patch.saleRabattTyp && patch.saleRabattWert != null) {
          const basis = resolveProductBasisPreis(existing)
          const validation = validateSaleDiscount(
            basis,
            patch.saleRabattTyp,
            patch.saleRabattWert
          )
          if (validation) {
            throw new Error(`${existing.name}: ${validation}`)
          }
        }
        const next = await applyPatchToProduct(existing, patch)
        return upsertProduct(next)
      })
    )

    return NextResponse.json({ updated: updated.length, products: updated })
  } catch (error) {
    console.error("URSACHE COSMOS FEHLER (admin products bulk PATCH):", error)
    const { message, status } = resolveCosmosApiError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
