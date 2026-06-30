import { NextResponse } from "next/server"
import { createChatSession, getChatSession, listChatMessages } from "@/lib/chat/chat-db"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      sessionId?: string
      visitorName?: string
    }

    if (body.sessionId) {
      const existing = await getChatSession(body.sessionId)
      if (existing) {
        const messages = await listChatMessages(existing.id)
        return NextResponse.json({ session: existing, messages })
      }
    }

    const session = await createChatSession(body.visitorName)
    const welcome = await listChatMessages(session.id)
    return NextResponse.json({ session, messages: welcome }, { status: 201 })
  } catch (error) {
    console.error("[Chat] Session konnte nicht erstellt werden.", error)
    return NextResponse.json(
      { error: "Chat-Session konnte nicht erstellt werden." },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim()
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId fehlt." }, { status: 400 })
  }

  const session = await getChatSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: "Session nicht gefunden." }, { status: 404 })
  }

  const messages = await listChatMessages(sessionId)
  return NextResponse.json({ session, messages })
}
