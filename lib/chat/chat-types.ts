export const CHAT_SESSION_DOC_TYPE = "chat_session" as const
export const CHAT_MESSAGE_DOC_TYPE = "chat_message" as const

export type ChatMessageRole = "visitor" | "admin" | "system"
export type ChatMessageSource = "web" | "whatsapp"

export type ChatSession = {
  id: string
  docType: typeof CHAT_SESSION_DOC_TYPE
  visitorName?: string
  visitorLabel: string
  status: "open" | "closed"
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

export type ChatMessage = {
  id: string
  docType: typeof CHAT_MESSAGE_DOC_TYPE
  sessionId: string
  role: ChatMessageRole
  content: string
  source: ChatMessageSource
  createdAt: string
}

export type PublicChatMessage = Pick<
  ChatMessage,
  "id" | "sessionId" | "role" | "content" | "createdAt"
>
