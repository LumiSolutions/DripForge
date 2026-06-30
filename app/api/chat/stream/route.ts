import { subscribeChatSession } from "@/lib/chat/chat-realtime"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim()
  if (!sessionId) {
    return new Response("sessionId fehlt", { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      send({ type: "connected", sessionId })

      const unsubscribe = subscribeChatSession(sessionId, (event) => {
        send(event)
      })

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"))
      }, 25000)

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat)
        unsubscribe()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
