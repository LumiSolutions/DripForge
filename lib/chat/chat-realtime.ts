import type { PublicChatMessage } from "@/lib/chat/chat-types"

type ChatEvent =
  | { type: "message"; message: PublicChatMessage }
  | { type: "ping" }

type Listener = (event: ChatEvent) => void

const listenersBySession = new Map<string, Set<Listener>>()

export function subscribeChatSession(sessionId: string, listener: Listener): () => void {
  let set = listenersBySession.get(sessionId)
  if (!set) {
    set = new Set()
    listenersBySession.set(sessionId, set)
  }
  set.add(listener)
  return () => {
    set?.delete(listener)
    if (set && set.size === 0) {
      listenersBySession.delete(sessionId)
    }
  }
}

export function publishChatMessage(message: PublicChatMessage): void {
  const set = listenersBySession.get(message.sessionId)
  if (!set) return
  for (const listener of set) {
    listener({ type: "message", message })
  }
}
