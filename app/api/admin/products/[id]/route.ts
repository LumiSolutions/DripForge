import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import {
  deleteProduct,
  getAdminProductById,
  upsertProduct,
} from "@/lib/admin/db"
import { normalizeAdminProductInput } from "@/lib/admin/normalize-product"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import type { AdminProduct } from "@/lib/admin/types"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const product = await getAdminProductById(id)
    if (!product) {
      return NextResponse.json(
        { error: "Produkt nicht gefunden." },
        { status: 404 }
      )
    }
    return NextResponse.json({ product })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.warn("Admin-API: Produkt konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Produkt konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const body = (await request.json()) as Partial<AdminProduct> & {
      variantenText?: string
    }
    const existing = await getAdminProductById(id)
    if (!existing) {
      return NextResponse.json(
        { error: "Produkt nicht gefunden." },
        { status: 404 }
      )
    }

    const product = normalizeAdminProductInput({ ...body, id }, existing)
    const saved = await upsertProduct(product)
    return NextResponse.json({ product: saved })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.warn("Admin-API: Produkt konnte nicht gespeichert werden.", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Produkt konnte nicht gespeichert werden.",
      },
      { status: 400 }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const ok = await deleteProduct(id)
    if (!ok) {
      return NextResponse.json(
        { error: "Produkt nicht gefunden." },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.warn("Admin-API: Produkt konnte nicht geloescht werden.", error)
    return NextResponse.json(
      { error: "Produkt konnte nicht geloescht werden." },
      { status: 500 }
    )
  }
}
