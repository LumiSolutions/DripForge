export function createChatSessionId(): string {
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createChatMessageId(): string {
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function buildVisitorLabel(visitorName?: string, sessionId?: string): string {
  const trimmed = visitorName?.trim()
  if (trimmed) return trimmed
  const suffix = sessionId?.slice(-6) ?? "gast"
  return `Gast-${suffix}`
}

/** Suffix für WhatsApp-Routing — Admin antwortet per Quote auf die Nachricht. */
export function formatWhatsAppRefTag(sessionId: string): string {
  return `Ref: ${sessionId}`
}

export function extractSessionIdFromText(text: string): string | null {
  const refMatch = text.match(/Ref:\s*(chat-[a-z0-9-]+)/i)
  if (refMatch?.[1]) return refMatch[1]

  const hashMatch = text.match(/#(chat-[a-z0-9-]+)/i)
  if (hashMatch?.[1]) return hashMatch[1]

  return null
}
