import {
  buildVisitorLabel,
  formatWhatsAppRefTag,
} from "@/lib/chat/chat-session-id"
import type {
  MetaSendMessageResponse,
  MetaSendTextMessagePayload,
} from "@/lib/chat/meta-whatsapp-types"
import {
  buildMetaMessagesUrl,
  getMetaWhatsAppConfig,
  normalizePhoneNumber,
} from "@/lib/chat/whatsapp-config"
import { storeWhatsAppOutboundRef } from "@/lib/chat/whatsapp-message-refs"

export function formatCustomerMessageForWhatsApp(
  sessionId: string,
  visitorName: string | undefined,
  content: string
): string {
  const label = buildVisitorLabel(visitorName, sessionId)
  const ref = formatWhatsAppRefTag(sessionId)
  return `👤 *Kunde ${label}:* ${content.trim()}\n\n---\n${ref}`
}

export async function sendWhatsAppTextToAdmin(
  sessionId: string,
  visitorName: string | undefined,
  content: string
): Promise<{ ok: boolean; skipped?: boolean; error?: string; messageId?: string }> {
  const config = getMetaWhatsAppConfig()
  if (!config) {
    console.info(
      "[WhatsApp] Meta API nicht konfiguriert — Nachricht nur in Cosmos gespeichert.",
      { sessionId }
    )
    return { ok: true, skipped: true }
  }

  if (!config.adminPhoneNumber) {
    console.warn(
      "[WhatsApp] META_ADMIN_PHONE_NUMBER fehlt — Benachrichtigung nicht gesendet.",
      { sessionId }
    )
    return { ok: true, skipped: true }
  }

  const body = formatCustomerMessageForWhatsApp(sessionId, visitorName, content)
  const url = buildMetaMessagesUrl(config.phoneNumberId)
  const payload: MetaSendTextMessagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhoneNumber(config.adminPhoneNumber),
    type: "text",
    text: { preview_url: false, body },
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = (await res.json().catch(() => ({}))) as MetaSendMessageResponse

    if (!res.ok) {
      console.error("[WhatsApp] Meta API Fehler:", res.status, data)
      return {
        ok: false,
        error: data.error?.message ?? "Meta WhatsApp API antwortete mit Fehler.",
      }
    }

    const messageId = data.messages?.[0]?.id
    if (messageId) {
      await storeWhatsAppOutboundRef(messageId, sessionId)
    }

    return { ok: true, messageId }
  } catch (error) {
    console.error("[WhatsApp] Meta API Senden fehlgeschlagen.", error)
    return { ok: false, error: "Meta WhatsApp API nicht erreichbar." }
  }
}
