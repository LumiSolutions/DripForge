import { NextResponse } from "next/server"
import { warmCosmosInfrastructure } from "@/lib/cosmos/client"
import { verifyPayrexxWebhookSignature } from "@/lib/payrexx/client"
import { fulfillPaidShopOrder } from "@/lib/shop/order-processing"
import { fulfillPointsPurchase } from "@/lib/shop/points-purchase"
import {
  deletePendingPointsPurchase,
  getPendingPointsPurchase,
} from "@/lib/shop/points-purchase-store"
import { isPointsPurchaseReference } from "@/lib/konto/loyalty-points"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type PayrexxWebhookTransaction = {
  status?: string
  referenceId?: string
  uuid?: string
  amount?: number
  invoice?: {
    referenceId?: string
  }
}

function parsePayrexxWebhookPayload(rawBody: string): PayrexxWebhookTransaction | null {
  const trimmed = rawBody.trim()
  if (!trimmed) return null

  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed) as {
        transaction?: PayrexxWebhookTransaction
      }
      return json.transaction ?? null
    } catch {
      return null
    }
  }

  const params = new URLSearchParams(rawBody)
  const nested = params.get("transaction")
  if (nested) {
    try {
      const parsed = JSON.parse(nested) as PayrexxWebhookTransaction
      return parsed
    } catch {
      /* fall through */
    }
  }

  const status = params.get("transaction[status]") ?? params.get("status")
  const referenceId =
    params.get("transaction[referenceId]") ??
    params.get("transaction[invoice][referenceId]") ??
    params.get("referenceId")
  const uuid = params.get("transaction[uuid]") ?? params.get("uuid")
  const amountRaw = params.get("transaction[amount]") ?? params.get("amount")

  if (!status && !referenceId) return null

  return {
    status: status ?? undefined,
    referenceId: referenceId ?? undefined,
    uuid: uuid ?? undefined,
    amount: amountRaw ? Number(amountRaw) : undefined,
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-webhook-signature")

  if (!verifyPayrexxWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Ungueltige Webhook-Signatur." }, { status: 401 })
  }

  const transaction = parsePayrexxWebhookPayload(rawBody)
  if (!transaction) {
    return NextResponse.json({ error: "Ungueltiger Webhook-Payload." }, { status: 400 })
  }

  if (transaction.status !== "confirmed") {
    return NextResponse.json({ received: true, ignored: true })
  }

  const orderId =
    transaction.referenceId?.trim() ||
    transaction.invoice?.referenceId?.trim() ||
    ""

  if (!orderId) {
    console.warn("Payrexx Webhook: confirmed ohne referenceId.")
    return NextResponse.json({ received: true, ignored: true })
  }

  try {
    await warmCosmosInfrastructure()

    const totalChf =
      transaction.amount != null && transaction.amount > 0
        ? Math.round(transaction.amount) / 100
        : 0

    if (isPointsPurchaseReference(orderId)) {
      const pending = await getPendingPointsPurchase(orderId)
      if (!pending) {
        console.warn(`Payrexx Webhook: Punktekauf ${orderId} nicht gefunden.`)
        return NextResponse.json({ received: true, ignored: true })
      }

      await fulfillPointsPurchase(
        orderId,
        pending.email,
        pending.points,
        transaction.uuid ?? orderId
      )
      await deletePendingPointsPurchase(orderId)
      return NextResponse.json({ received: true, purchaseId: orderId })
    }

    await fulfillPaidShopOrder(orderId, {
      payrexxTransactionUuid: transaction.uuid ?? null,
      totalChf,
    })

    return NextResponse.json({ received: true, orderId })
  } catch (error) {
    console.error("Payrexx Webhook: Verarbeitung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Webhook-Verarbeitung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
