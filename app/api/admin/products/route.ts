import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import { getAdminProducts, upsertProduct } from "@/lib/admin/db"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { normalizeAdminProductInput } from "@/lib/admin/normalize-product"
import { allocateNextProductSku, normalizeProductSku } from "@/lib/admin/product-sku"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { AdminProduct } from "@/lib/admin/types"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const products = await getAdminProducts()
    return NextResponse.json({ products })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin-API: Produkte konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Produkte konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await warmCosmosInfrastructure()
    const body = (await request.json()) as Partial<AdminProduct> & {
      variantenText?: string
    }
    const existingProducts = await getAdminProducts()
    const sku =
      normalizeProductSku(body.sku) ?? allocateNextProductSku(existingProducts)
    const product = normalizeAdminProductInput({ ...body, sku })
    const saved = await upsertProduct(product)
    return NextResponse.json({ product: saved }, { status: 201 })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.warn("Admin-API: Produkt konnte nicht erstellt werden.", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Produkt konnte nicht erstellt werden.",
      },
      { status: 400 }
    )
  }
}
