import { NextResponse } from "next/server"
import { listChatMessages } from "@/lib/chat/chat-db"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim()
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId fehlt." }, { status: 400 })
  }

  try {
    const messages = await listChatMessages(sessionId)
    return NextResponse.json({ messages })
  } catch (error) {
    console.error("[Chat] Nachrichten konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Nachrichten konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}
