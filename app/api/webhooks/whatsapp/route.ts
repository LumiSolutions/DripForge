import { NextResponse } from "next/server"
import {
  appendChatMessage,
  getChatSession,
  getLatestOpenChatSession,
} from "@/lib/chat/chat-db"
import { publishChatMessage } from "@/lib/chat/chat-realtime"
import {
  parseMetaWebhookPayload,
  validateMetaInboundMessage,
  verifyMetaWebhookChallenge,
} from "@/lib/chat/whatsapp-webhook"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const challengeResponse = verifyMetaWebhookChallenge(request)
  if (challengeResponse) return challengeResponse
  return new Response("Forbidden", { status: 403 })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const inboundMessages = await parseMetaWebhookPayload(body)

    if (inboundMessages.length === 0) {
      return NextResponse.json({ ok: true, ignored: true, reason: "no_text_message" })
    }

    const processed: Array<{ sessionId: string; messageId: string }> = []

    for (const parsed of inboundMessages) {
      const validation = validateMetaInboundMessage(parsed)
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: validation.status })
      }

      let sessionId = parsed.sessionId
      if (!sessionId) {
        const latest = await getLatestOpenChatSession()
        sessionId = latest?.id ?? null
      }

      if (!sessionId) {
        return NextResponse.json(
          {
            error:
              "Keine Chat-Session zuordenbar. Bitte auf die Kundennachricht antworten (Quote).",
          },
          { status: 404 }
        )
      }

      const session = await getChatSession(sessionId)
      if (!session) {
        return NextResponse.json({ error: "Chat-Session nicht gefunden." }, { status: 404 })
      }

      const replyText = parsed.text.trim()
      if (!replyText) continue

      const message = await appendChatMessage({
        sessionId,
        role: "admin",
        content: replyText,
        source: "whatsapp",
      })

      if (!message) {
        return NextResponse.json(
          { error: "Antwort konnte nicht gespeichert werden." },
          { status: 500 }
        )
      }

      publishChatMessage(message)
      processed.push({ sessionId, messageId: message.id })
    }

    return NextResponse.json({ ok: true, processed })
  } catch (error) {
    console.error("[WhatsApp Webhook] Verarbeitung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Webhook konnte nicht verarbeitet werden." },
      { status: 500 }
    )
  }
}
