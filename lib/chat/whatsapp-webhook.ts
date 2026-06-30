import { extractSessionIdFromText } from "@/lib/chat/chat-session-id"
import type {
  MetaWebhookPayload,
  MetaWebhookTextMessage,
  ParsedMetaWhatsAppInbound,
} from "@/lib/chat/meta-whatsapp-types"
import { getMetaWhatsAppWebhookConfig, phonesMatch } from "@/lib/chat/whatsapp-config"
import { getSessionIdByWhatsAppMessageId } from "@/lib/chat/whatsapp-message-refs"

export type { ParsedMetaWhatsAppInbound as ParsedWhatsAppInbound }

function readTextBody(message: MetaWebhookTextMessage): string {
  return message.text?.body?.trim() ?? ""
}

async function resolveSessionId(
  message: MetaWebhookTextMessage
): Promise<string | null> {
  const text = readTextBody(message)
  const fromText = extractSessionIdFromText(text)
  if (fromText) return fromText

  const quotedId = message.context?.id?.trim()
  if (quotedId) {
    const fromQuote = await getSessionIdByWhatsAppMessageId(quotedId)
    if (fromQuote) return fromQuote
  }

  return null
}

export function verifyMetaWebhookChallenge(request: Request): Response | null {
  const config = getMetaWhatsAppWebhookConfig()
  if (!config) {
    return new Response("WhatsApp nicht konfiguriert.", { status: 503 })
  }

  const url = new URL(request.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  if (mode === "subscribe" && token === config.verifyToken && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })
  }

  return new Response("Forbidden", { status: 403 })
}

export async function parseMetaWebhookPayload(
  body: unknown
): Promise<ParsedMetaWhatsAppInbound[]> {
  if (!body || typeof body !== "object") return []
  const payload = body as MetaWebhookPayload

  if (payload.object !== "whatsapp_business_account") return []

  const results: ParsedMetaWhatsAppInbound[] = []

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue
      const value = change.value
      if (!value?.messages?.length) continue

      for (const message of value.messages) {
        if (message.type !== "text") continue
        const text = readTextBody(message)
        if (!text) continue

        const sessionId = await resolveSessionId(message)

        results.push({
          fromPhone: message.from,
          text,
          messageId: message.id,
          quotedMessageId: message.context?.id,
          businessAccountId: entry.id,
          phoneNumberId: value.metadata?.phone_number_id,
          sessionId,
        })
      }
    }
  }

  return results
}

export function validateMetaInboundMessage(
  parsed: ParsedMetaWhatsAppInbound
): { ok: true } | { ok: false; status: number; error: string } {
  const config = getMetaWhatsAppWebhookConfig()
  if (!config) {
    return { ok: false, status: 503, error: "WhatsApp ist nicht konfiguriert." }
  }

  if (
    parsed.businessAccountId &&
    parsed.businessAccountId !== config.businessAccountId
  ) {
    return {
      ok: false,
      status: 403,
      error: "Business-Account-ID stimmt nicht überein.",
    }
  }

  if (
    parsed.phoneNumberId &&
    parsed.phoneNumberId !== config.phoneNumberId
  ) {
    return {
      ok: false,
      status: 403,
      error: "Phone-Number-ID stimmt nicht überein.",
    }
  }

  if (config.adminPhoneNumber && !phonesMatch(parsed.fromPhone, config.adminPhoneNumber)) {
    return { ok: false, status: 403, error: "Absender ist nicht der Admin-Account." }
  }

  return { ok: true }
}
