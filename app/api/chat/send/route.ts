import { NextResponse } from "next/server"
import {
  appendChatMessage,
  getChatSession,
  updateChatSessionVisitorName,
} from "@/lib/chat/chat-db"
import { publishChatMessage } from "@/lib/chat/chat-realtime"
import { sendWhatsAppTextToAdmin } from "@/lib/chat/whatsapp-gateway"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string
      content?: string
      visitorName?: string
    }

    const sessionId = body.sessionId?.trim()
    const content = body.content?.trim()

    if (!sessionId || !content) {
      return NextResponse.json(
        { error: "sessionId und content sind Pflichtfelder." },
        { status: 400 }
      )
    }

    if (content.length > 4000) {
      return NextResponse.json(
        { error: "Nachricht ist zu lang (max. 4000 Zeichen)." },
        { status: 400 }
      )
    }

    const session = await getChatSession(sessionId)
    if (!session) {
      return NextResponse.json({ error: "Chat-Session nicht gefunden." }, { status: 404 })
    }

    if (body.visitorName?.trim() && body.visitorName.trim() !== session.visitorName) {
      await updateChatSessionVisitorName(sessionId, body.visitorName.trim())
    }

    const message = await appendChatMessage({
      sessionId,
      role: "visitor",
      content,
      source: "web",
    })

    if (!message) {
      return NextResponse.json(
        { error: "Nachricht konnte nicht gespeichert werden." },
        { status: 500 }
      )
    }

    publishChatMessage(message)

    const whatsapp = await sendWhatsAppTextToAdmin(
      sessionId,
      body.visitorName?.trim() || session.visitorName,
      content
    )

    return NextResponse.json({
      message,
      whatsappDelivered: whatsapp.ok && !whatsapp.skipped,
      whatsappSkipped: Boolean(whatsapp.skipped),
      whatsappError: whatsapp.error,
    })
  } catch (error) {
    console.error("[Chat] Senden fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Nachricht konnte nicht gesendet werden." },
      { status: 500 }
    )
  }
}
