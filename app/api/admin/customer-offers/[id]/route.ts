import { NextResponse } from "next/server"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import {
  deleteCustomerOffer,
  getOfferById,
  saveCustomerOffer,
} from "@/lib/konto/offers-db"
import {
  normalizeCustomerOffer,
  type CustomerOfferAttachment,
  type CustomerOfferStatus,
} from "@/lib/konto/customer-offer-types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

const STATUSES: CustomerOfferStatus[] = [
  "active",
  "accepted",
  "expired",
  "withdrawn",
]

function parseAttachments(raw: unknown): CustomerOfferAttachment[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const item = entry as Record<string, unknown>
      const url = typeof item.url === "string" ? item.url.trim() : ""
      const fileName =
        typeof item.fileName === "string" ? item.fileName.trim() : ""
      if (!url || !fileName) return null
      return {
        id:
          typeof item.id === "string" && item.id.trim()
            ? item.id.trim()
            : `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: fileName.slice(0, 240),
        mimeType:
          typeof item.mimeType === "string" && item.mimeType.trim()
            ? item.mimeType.trim()
            : "application/octet-stream",
        url,
      } satisfies CustomerOfferAttachment
    })
    .filter((entry): entry is CustomerOfferAttachment => Boolean(entry))
}

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const offer = await getOfferById(decodeURIComponent(id))
    if (!offer) {
      return NextResponse.json(
        { error: "Angebot nicht gefunden." },
        { status: 404 }
      )
    }
    return NextResponse.json({ offer })
  } catch (error) {
    console.warn("Admin-API: Kunden-Angebot laden fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Angebot konnte nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const existing = await getOfferById(decodeURIComponent(id))
    if (!existing) {
      return NextResponse.json(
        { error: "Angebot nicht gefunden." },
        { status: 404 }
      )
    }

    const body = (await request.json()) as Partial<{
      title: string
      description: string
      priceChf: number | null
      status: CustomerOfferStatus
      previewUrl: string | null
      attachments: CustomerOfferAttachment[]
    }>

    const nextPrice =
      body.priceChf === null
        ? null
        : typeof body.priceChf === "number" && Number.isFinite(body.priceChf)
          ? body.priceChf
          : existing.priceChf

    const attachments =
      body.attachments !== undefined
        ? parseAttachments(body.attachments)
        : existing.attachments

    const previewUrl =
      body.previewUrl === null
        ? null
        : typeof body.previewUrl === "string"
          ? body.previewUrl.trim() || null
          : existing.previewUrl

    const patched = normalizeCustomerOffer({
      ...existing,
      title:
        typeof body.title === "string" ? body.title.trim() || existing.title : existing.title,
      description:
        typeof body.description === "string"
          ? body.description
          : existing.description,
      priceChf: nextPrice,
      status:
        typeof body.status === "string" && STATUSES.includes(body.status)
          ? body.status
          : existing.status,
      previewUrl,
      attachments,
      cartItem: {
        ...existing.cartItem,
        name:
          typeof body.title === "string" && body.title.trim()
            ? body.title.trim()
            : existing.cartItem.name,
        price:
          nextPrice != null && Number.isFinite(nextPrice)
            ? nextPrice
            : existing.cartItem.price,
        leitbild: previewUrl ?? existing.cartItem.leitbild,
      },
      updatedAt: new Date().toISOString(),
    })

    if (!patched) {
      return NextResponse.json(
        { error: "Ungültige Angebotsdaten." },
        { status: 400 }
      )
    }

    const saved = await saveCustomerOffer(patched)
    return NextResponse.json({ offer: saved })
  } catch (error) {
    console.warn("Admin-API: Kunden-Angebot Update fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Update fehlgeschlagen." },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const ok = await deleteCustomerOffer(decodeURIComponent(id))
    if (!ok) {
      return NextResponse.json(
        { error: "Angebot nicht gefunden." },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.warn("Admin-API: Kunden-Angebot löschen fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Löschen fehlgeschlagen." },
      { status: 500 }
    )
  }
}
